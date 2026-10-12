import { ReactNode } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Assistant from '../src/pages/Assistant/Assistant'
import ChatMessage from '../src/components/assistant/ChatMessage'
import { useAssistantChat } from '../src/hooks/useAssistantChat'
import { assistantApi } from '../src/services/assistantApi'
import { Conversation } from '../src/types/chat.types'
const auth = vi.hoisted(() => ({ isAuthenticated: true, user: { id: 'test-user' } }))
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => auth }))
vi.mock('../src/components/templates/PageTemplate', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('../src/services/assistantApi', () => ({ assistantApi:{list:vi.fn(),get:vi.fn(),create:vi.fn(),send:vi.fn(),remove:vi.fn()},getChatErrorMessage: () => 'Connection failed.' }))
const api = vi.mocked(assistantApi)
const saved = new Map<string,Conversation>()
const wrapper = ({children}:{children:ReactNode})=><MemoryRouter>{children}</MemoryRouter>
const page = (path='/assistant') => render(<MemoryRouter initialEntries={[path]}><Assistant /></MemoryRouter>)
const question = async (text:string) => {
  fireEvent.change(screen.getByRole('textbox'), {target:{value:text}})
  fireEvent.click(screen.getByRole('button',{name:'Send'}))
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Stop'})).not.toBeInTheDocument())
}
beforeEach(()=>{
  vi.clearAllMocks(); saved.clear(); auth.isAuthenticated=true
  api.list.mockImplementation(async()=>Array.from(saved.values()))
  api.get.mockImplementation(async id=>structuredClone(saved.get(id)!))
  api.create.mockImplementation(async(id,mode)=>{
    const value:Conversation={id,mode,title:'New conversation',createdAt:'2026-10-12',updatedAt:'2026-10-12',turns:[]}
    saved.set(id,value);return structuredClone(value)
  })
  api.send.mockImplementation(async(id,request)=>{
    const value=saved.get(id)!
    value.title=request.message
    value.turns.push({id:request.requestId,requestId:request.requestId,prompt:request.message,answer:'## Strength\n\nAn explanation.',status:'completed',truncated:false,createdAt:'2026-10-12'})
    return structuredClone(value)
  })
  api.remove.mockImplementation(async id=>{saved.delete(id)})
})
describe('persistent assistant',()=>{
  it('selects and toggles a focus without creating a chat or sending anything',async()=>{
    page()
    const explain=screen.getByRole('button',{name:/Explain concepts/})
    fireEvent.click(explain)
    expect(explain).toHaveAttribute('aria-pressed','true')
    expect(api.create).not.toHaveBeenCalled();expect(api.send).not.toHaveBeenCalled()
    expect(screen.queryByText('Thinking through your question')).not.toBeInTheDocument()
    fireEvent.click(explain)
    expect(explain).toHaveAttribute('aria-pressed','false')
    await waitFor(()=>expect(api.list).toHaveBeenCalled())
  })
  it('locks focus only on send, hides cards and keeps follow-ups separate from system instructions',async()=>{
    page();fireEvent.click(screen.getByRole('button',{name:/Explain concepts/}))
    await question('What is strength?')
    expect(api.create).toHaveBeenCalledWith(expect.any(String),'explain_concepts',expect.any(AbortSignal))
    expect(api.send.mock.calls[0][1]).toEqual({requestId:expect.any(String),message:'What is strength?'})
    expect(screen.queryByRole('group',{name:'Optional conversation focus'})).not.toBeInTheDocument()
    await question('And power?')
    expect(api.create).toHaveBeenCalledTimes(1)
    expect(api.send.mock.calls[1][1]).toEqual({requestId:expect.any(String),message:'And power?'})
    expect(screen.getAllByRole('heading',{name:'Strength'})).toHaveLength(2)
  })
  it('uses general mode by default and restores messages from the saved URL after remount',async()=>{
    const first=page();await question('Explain strength')
    const id=api.create.mock.calls[0][0]
    expect(api.create.mock.calls[0][1]).toBe('general')
    first.unmount();page(`/assistant?chat=${id}`)
    expect(await screen.findByRole('heading',{name:'Strength'})).toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(api.send).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button',{name:'New conversation'}))
    expect(screen.getByRole('group')).toBeInTheDocument()
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
  })
  it('retries using the same request ID without duplicating the question',async()=>{
    api.send.mockRejectedValueOnce(new Error('offline'))
    page();await question('Recovery?')
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed.')
    fireEvent.click(screen.getByRole('button',{name:'Retry'}))
    await screen.findByRole('heading',{name:'Strength'})
    expect(api.send.mock.calls[1][1]).toEqual(api.send.mock.calls[0][1])
    expect(screen.getByRole('log').textContent?.match(/Recovery\?/g)).toHaveLength(1)
  })
  it('ignores a stale answer after starting a new conversation',async()=>{
    let resolve!:(value:Conversation)=>void
    api.send.mockImplementationOnce(()=>new Promise(done=>{resolve=done}))
    const {result}=renderHook(()=>useAssistantChat('test-user'),{wrapper})
    act(()=>{expect(result.current.send('First')).toBe(true);expect(result.current.send('Second')).toBe(false)})
    await waitFor(()=>expect(api.send).toHaveBeenCalledTimes(1))
    const value=structuredClone(Array.from(saved.values())[0])
    act(()=>result.current.reset())
    await act(async()=>{resolve(value)})
    expect(result.current.messages).toEqual([]);expect(result.current.isSending).toBe(false)
  })
  it('retrying a failed history read never creates a new conversation',async()=>{
    api.get.mockRejectedValue(new Error('storage'))
    page('/assistant?chat=missing')
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button',{name:'Retry'}))
    await waitFor(()=>expect(api.get).toHaveBeenCalledTimes(2))
    expect(api.create).not.toHaveBeenCalled();expect(api.send).not.toHaveBeenCalled()
  })
  it('renders untrusted Markdown safely',()=>{
    const {container}=render(<ChatMessage message={{id:'1',role:'assistant',mode:'general',content:'<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n![track](https://example.invalid/pixel)\n\n**Safe text**'}} />)
    expect(container.querySelector('script')).toBeNull();expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('a')?.getAttribute('href')).not.toMatch(/^javascript:/)
    expect(screen.getByText('Safe text').tagName).toBe('STRONG')
  })
})

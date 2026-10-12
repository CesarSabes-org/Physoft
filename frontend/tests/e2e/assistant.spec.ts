import { test, expect } from '@playwright/test'
import type { Conversation } from '../../src/types/chat.types'

test('focus selection waits for send; conversations survive reload on desktop and mobile',async({page},testInfo)=>{
  await page.addInitScript(()=>{
    const payload=btoa(JSON.stringify({id:'ui-test',email:'test@example.invalid',role:'ADMIN',exp:Math.floor(Date.now()/1000)+3600}))
    localStorage.setItem('physoft_auth_token',`synthetic.${payload}.not-a-real-signature`)
  })
  const chats=new Map<string,Conversation>()
  const messages:{message:string;requestId:string}[]=[]
  let creations=0
  await page.route('**/api/chat/conversations**',async route=>{
    const request=route.request()
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, DELETE, OPTIONS'}
    if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return}
    const parts=new URL(request.url()).pathname.split('/')
    const id=parts[4]
    let data:unknown
    if(request.method()==='GET') data=id?chats.get(id):Array.from(chats.values())
    else if(request.method()==='POST'&&!id){
      const body=request.postDataJSON();creations++
      data={id:body.id,mode:body.mode,title:'New conversation',createdAt:'2026-10-12',updatedAt:'2026-10-12',turns:[]}
      chats.set(body.id,data as Conversation)
    }else if(request.method()==='POST'){
      const body=request.postDataJSON();messages.push(body)
      const chat=chats.get(id)!
      chat.title=body.message
      chat.turns.push({id:body.requestId,requestId:body.requestId,prompt:body.message,answer:'## Strength and power\n\n**Strength** describes force production.',status:'completed',truncated:false,createdAt:'2026-10-12'})
      data=chat
    }else{chats.delete(id);data=null}
    await route.fulfill({json:{success:true,data},headers})
  })
  await page.goto('/assistant')
  await page.getByRole('button',{name:/Explain concepts/}).click()
  await expect(page.getByRole('button',{name:/Explain concepts/})).toHaveAttribute('aria-pressed','true')
  expect(creations).toBe(0);expect(messages).toHaveLength(0)
  await page.screenshot({path:testInfo.outputPath('assistant-selected.png'),fullPage:true})
  await page.getByRole('textbox').fill('What is strength?')
  await page.getByRole('button',{name:'Send',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Strength and power'})).toBeVisible()
  await expect(page.getByRole('group',{name:'Optional conversation focus'})).toHaveCount(0)
  expect(Array.from(chats.values())[0].mode).toBe('explain_concepts')
  expect(messages[0]).toEqual({message:'What is strength?',requestId:expect.any(String)})
  await page.reload()
  await expect(page.getByRole('heading',{name:'Strength and power'})).toBeVisible()
  await page.getByRole('textbox').fill('And power?')
  await page.getByRole('button',{name:'Send',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Strength and power'})).toHaveCount(2)
  expect(creations).toBe(1)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await page.screenshot({path:testInfo.outputPath('assistant-saved.png'),fullPage:true})
  await page.getByRole('button',{name:'New conversation'}).click()
  await expect(page.getByRole('group',{name:'Optional conversation focus'})).toBeVisible()
  await page.getByRole('button',{name:/And power\? Explain concepts/}).click()
  await expect(page.getByRole('heading',{name:'Strength and power'})).toHaveCount(2)
})

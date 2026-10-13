import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import RootRedirect from './components/RootRedirect'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import Patients from './pages/Patients/Patients'
import Analysis from './pages/Analysis/Analysis'
import AllAnalyses from './pages/AllAnalyses/AllAnalyses'
import AthleteDetail from './pages/AthleteDetail/AthleteDetail'
import AddAthlete from './pages/AddAthlete/AddAthlete'
import EditAthlete from './pages/EditAthlete/EditAthlete'
import NewAnalysis from './pages/NewAnalysis/NewAnalysis'
import EditAnalysis from './pages/EditAnalysis/EditAnalysis'
import AnalysisView from './pages/AnalysisView/AnalysisView'
import AssessmentReport from './pages/AssessmentReport/AssessmentReport'
import Analytics from './pages/Analytics/Analytics'
import Reports from './pages/Reports/Reports'
import Protocols from './pages/Protocols/Protocols'
import LoadingSpinner from './components/common/feedback/LoadingSpinner'
import Settings from './pages/Settings/Settings'
import Profile from './pages/Profile/Profile'
import './styles/index.css'

// Keep the assistant's Markdown renderer out of the initial application bundle.
const Assistant = lazy(() => import('./pages/Assistant/Assistant'))

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/all-analyses" element={<AllAnalyses />} />
          <Route path="/athlete-detail/:id" element={<AthleteDetail />} />
          <Route path="/add-athlete" element={<AddAthlete />} />
          <Route path="/athletes/edit/:id" element={<EditAthlete />} />
          <Route path="/new-analysis" element={<NewAnalysis />} />
          <Route path="/analysis/edit/:id" element={<EditAnalysis />} />
          <Route path="/analysis-view/:id" element={<AnalysisView />} />
          <Route path="/analysis-view/:id/report" element={<AssessmentReport />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/protocols" element={<Protocols />} />
          <Route path="/assistant" element={<Suspense fallback={<LoadingSpinner />}><Assistant /></Suspense>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App

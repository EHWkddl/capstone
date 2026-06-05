import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'

import Header from './components/Header'
import Footer from './components/Footer'

import HomePage from './pages/HomePage'
import ConsolePage from './pages/ConsolePage'
import LogsPage from './pages/LogsPage'
import CriteriaPage from './pages/CriteriaPage'
import TestPage from './pages/TestPage'
import GuidePage from './pages/GuidePage'

function App() {
  return (
    <BrowserRouter>
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/console" element={<ConsolePage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/criteria" element={<CriteriaPage />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/guide" element={<GuidePage />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  )
}

export default App

import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ConformityAssessment from './pages/ConformityAssessment';
import MarkingFee from './pages/MarkingFee';
import StandardsList from './pages/StandardsList';
import ApplyFormI from './pages/ApplyFormI';
import Applications from './pages/Applications';
import Complaints from './pages/Complaints';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import ComingSoon from './pages/ComingSoon';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/conformity-assessment" element={<ProtectedRoute><Layout><ConformityAssessment /></Layout></ProtectedRoute>} />
      <Route path="/marking-fee" element={<ProtectedRoute><Layout><MarkingFee /></Layout></ProtectedRoute>} />
      <Route path="/standards-under-certification" element={<ProtectedRoute><Layout><StandardsList /></Layout></ProtectedRoute>} />
      <Route path="/apply" element={<ProtectedRoute><Layout><ApplyFormI /></Layout></ProtectedRoute>} />
      <Route path="/applications" element={<Layout><Applications /></Layout>} />
      <Route path="/complaints" element={<Layout><Complaints /></Layout>} />
      <Route path="/coming-soon" element={<ProtectedRoute><Layout><ComingSoon /></Layout></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

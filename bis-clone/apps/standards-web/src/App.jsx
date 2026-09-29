import { Routes, Route } from 'react-router-dom';
import KnowYourStandards from './pages/KnowYourStandards';
import StandardDetails from './pages/StandardDetails';
import ComingSoon from './pages/ComingSoon';
import Layout from './components/Layout';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<KnowYourStandards />} />
        <Route path="/know-your-standards" element={<KnowYourStandards />} />
        <Route path="/standard-details/:isSlug" element={<StandardDetails />} />
        <Route path="/coming-soon" element={<ComingSoon />} />
      </Routes>
    </Layout>
  );
}

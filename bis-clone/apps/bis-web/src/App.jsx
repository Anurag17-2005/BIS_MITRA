import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import ProductManuals from './pages/ProductManuals';
import CertificationProcess from './pages/CertificationProcess';
import ApplyOnline from './pages/ApplyOnline';
import Overview from './pages/Overview';
import CompulsoryCertification from './pages/CompulsoryCertification';
import News from './pages/News';
import DemoConsole from './pages/DemoConsole';
import ConsumerGuidance from './pages/ConsumerGuidance';
import ConsumerComplaints from './pages/ConsumerComplaints';
import RegulatoryHub from './pages/RegulatoryHub';
import DocumentLibrary from './pages/DocumentLibrary';
import ComingSoon from './pages/ComingSoon';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout sidebar={false}><Home /></Layout>} />
      <Route path="/product-certification/overview" element={<Layout><Overview /></Layout>} />
      <Route path="/product-certification/process" element={<Layout><CertificationProcess /></Layout>} />
      <Route path="/product-certification/compulsory" element={<Layout><CompulsoryCertification /></Layout>} />
      <Route path="/product-manuals" element={<Layout><ProductManuals /></Layout>} />
      <Route path="/news" element={<Layout sidebar={false}><News /></Layout>} />
      <Route path="/coming-soon" element={<Layout sidebar={false}><ComingSoon /></Layout>} />
      <Route path="/library" element={<Layout sidebar={false}><DocumentLibrary /></Layout>} />
      <Route path="/apply-online" element={<Layout><ApplyOnline /></Layout>} />
      <Route path="/consumer-guidance" element={<Layout><ConsumerGuidance /></Layout>} />
      <Route path="/consumer/complaints" element={<Layout><ConsumerComplaints /></Layout>} />
      <Route path="/clone/consumer/complaints" element={<Layout><ConsumerComplaints /></Layout>} />
      <Route path="/regulatory-hub" element={<Layout><RegulatoryHub /></Layout>} />
      <Route path="/demo-console" element={<Layout sidebar={false}><DemoConsole /></Layout>} />
    </Routes>
  );
}

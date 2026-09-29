import { useSearchParams } from 'react-router-dom';

export default function ComingSoon() {
  const [params] = useSearchParams();
  const page = params.get('page') || 'This section';
  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 24px' }}>
      <h1 className="bis-page-title" style={{ color: '#003366' }}>{page}</h1>
      <p style={{ color: '#555', lineHeight: 1.6 }}>
        This area is marked <strong>Coming soon</strong> in Clone B. Working demo paths are Home,
        News, Product Manuals, Certification Process, Compulsory Certification, Apply Online,
        eBIS (login / marking fee / standards list), and Know Your Standards.
      </p>
    </div>
  );
}

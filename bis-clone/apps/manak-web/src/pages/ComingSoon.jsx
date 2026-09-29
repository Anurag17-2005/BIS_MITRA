import { useSearchParams } from 'react-router-dom';

export default function ComingSoon() {
  const [params] = useSearchParams();
  const page = params.get('page') || 'This module';
  return (
    <div>
      <h1 className="page-title">{page}</h1>
      <p style={{ color: '#555' }}>Coming soon in this prototype. Use Conformity Assessment, Marking Fee, or Standards Under Certification.</p>
    </div>
  );
}

import { useSearchParams } from 'react-router-dom';

export default function ComingSoon() {
  const [params] = useSearchParams();
  const page = params.get('page') || 'This section';
  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '24px' }}>
      <h2 style={{ color: '#003366' }}>{page}</h2>
      <p style={{ color: '#555' }}>Coming soon. Use Know Your Standards search for the working demo.</p>
    </div>
  );
}

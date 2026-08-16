import { Link } from 'react-router';
import { Button } from '@/ui/kit';

export default function NotFound() {
  return (
    <div className="page stack">
      <h1>Nothing here</h1>
      <p className="muted">That page does not exist. A wrong turn in the dungeon.</p>
      <div>
        <Link to="/campaigns">
          <Button variant="secondary">Back to your campaigns</Button>
        </Link>
      </div>
    </div>
  );
}

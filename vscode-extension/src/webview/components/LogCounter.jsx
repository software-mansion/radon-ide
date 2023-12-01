import './LogCounter.css';

function LogCounter({ count }) {
  if (count <= 0) {
    return null;
  }
  return <span className="log-counter">{count}</span>;
}

export default LogCounter;

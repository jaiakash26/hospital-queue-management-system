// File: frontend/src/components/LiveTokenCard.jsx
// The patient's live token: your number, now serving, wait time. Updates by itself.
import useLiveQueue from '../hooks/useLiveQueue';

export default function LiveTokenCard({ token }) {
  const queue = useLiveQueue(token.doctor_id);
  if (!queue) return <div className="bg-white rounded-xl shadow p-5">Loading queue...</div>;

  // Find my own row inside the live queue
  const me = queue.queue.find((q) => q.token_number === token.token_number);

  return (
    <div className="bg-white rounded-xl shadow p-5 border-l-4 border-blue-600">
      <p className="text-gray-500">{token.doctor_name}</p>
      <div className="flex gap-10 my-2">
        <div>
          <p className="text-xs text-gray-500">YOUR TOKEN</p>
          <p className="text-5xl font-bold text-blue-600">{token.token_number}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">NOW SERVING</p>
          <p className="text-5xl font-bold">{queue.now_serving ?? '-'}</p>
        </div>
      </div>
      {!me ? (
        <p className="text-green-600 font-medium">Your visit is finished.</p>
      ) : me.status === 'called' ? (
        <p className="text-green-600 font-bold text-lg">🎉 It's your turn! Please go to the doctor's room.</p>
      ) : (
        <p>Patients ahead: <b>{me.patients_ahead}</b> · Estimated wait: <b>~{me.estimated_wait_minutes} min</b></p>
      )}
    </div>
  );
}
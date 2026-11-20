import { useState } from 'react';
import { tripsApi, errorMessage } from '../api';
import { useApp } from '../lib/context';
import { Field, Modal, Notice, StarInput } from '../lib/ui';

export function RatingModal({
  tripId,
  tripLabel,
  onClose,
}: {
  tripId: string;
  tripLabel?: string;
  onClose: () => void;
}) {
  const { userSession, toast } = useApp();
  const [companyStars, setCompanyStars] = useState(5);
  const [driverStars, setDriverStars] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!userSession) return;
    setBusy(true);
    setError('');
    try {
      await tripsApi.rate(tripId, userSession.token, { companyStars, driverStars, comment: comment.trim() || undefined });
      toast('Merci pour votre note !', 'success');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Noter le trajet"
      subtitle={tripLabel || 'Votre avis nous aide à améliorer le service.'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Envoi…' : 'Envoyer mon avis'}
          </button>
        </>
      }
    >
      {error && <div style={{ marginBottom: 12 }}><Notice tone="error">{error}</Notice></div>}
      <Field label="Note pour la compagnie">
        <StarInput value={companyStars} onChange={setCompanyStars} />
      </Field>
      <Field label="Note pour le chauffeur">
        <StarInput value={driverStars} onChange={setDriverStars} />
      </Field>
      <Field label="Commentaire (facultatif)">
        <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Décrivez votre expérience…" />
      </Field>
    </Modal>
  );
}

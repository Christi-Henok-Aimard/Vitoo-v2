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
  const { userSession, toast, t } = useApp();
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
      toast(t('thanksReview'), 'success');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('rateTrip')}
      subtitle={tripLabel || t('rateTrip')}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? t('loading') : t('sendReview')}
          </button>
        </>
      }
    >
      {error && <div style={{ marginBottom: 12 }}><Notice tone="error">{error}</Notice></div>}
      <Field label={t('rateCompany')}>
        <StarInput value={companyStars} onChange={setCompanyStars} />
      </Field>
      <Field label={t('rateDriver')}>
        <StarInput value={driverStars} onChange={setDriverStars} />
      </Field>
      <Field label={`${t('comment')} (${t('optional')})`}>
        <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('comment')} />
      </Field>
    </Modal>
  );
}

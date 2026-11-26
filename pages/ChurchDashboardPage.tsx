import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './ChurchPages.css';
import {
  ChurchBoard,
  churchToken,
  loadChurchSeats,
  markTestChurchPaid,
  setChurchToken,
} from '../services/churchService';

const appLabel = (app: string) => (app === 'faith-defense' ? 'Faith Defense' : 'Godly Kids');

const ChurchDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [board, setBoard] = useState<ChurchBoard | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const next = await loadChurchSeats();
    setBoard(next);
  };

  useEffect(() => {
    if (!churchToken()) {
      navigate('/church/sign-up', { replace: true });
      return;
    }
    load().catch((err) => setError(err instanceof Error ? err.message : 'Could not load seats.'));
  }, [navigate]);

  const markPaid = async () => {
    setBusy(true);
    setError('');
    try {
      await markTestChurchPaid();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark the test church paid.');
    } finally {
      setBusy(false);
    }
  };

  if (!board && !error) {
    return (
      <div className="church-screen">
        <div className="church-screen-bg" />
        <div className="church-wrap"><p>Loading your church…</p></div>
      </div>
    );
  }

  const church = board?.church;
  const plan = church?.plan;

  return (
    <div className="church-screen">
      <div className="church-screen-bg" />
      <div className="church-wrap">
        <div className="church-top">
          <Link className="church-link" to="/">Home</Link>
          <button
            className="church-button secondary"
            type="button"
            onClick={() => {
              setChurchToken(null);
              navigate('/church/sign-in');
            }}
          >
            Sign out
          </button>
        </div>
        <h1 className="church-sign">{church?.name || 'Church'}</h1>
        {error && <p className="church-error" role="alert">{error}</p>}
        {church && plan && (
          <div className="church-dashboard-head">
            <section className="church-card">
              <p className="church-note">Family code</p>
              <p className="church-code" data-testid="church-code">{church.joinCode}</p>
              <p className="church-note">One code for this church. A family enters it in Godly Kids or Faith Defense and takes one seat.</p>
            </section>
            <section className="church-card">
              <div className="church-plan">
                <strong>${plan.priceUsd.toLocaleString('en-US')}</strong>
                <span>per year · {plan.seatLimit} seats</span>
              </div>
              <p className="church-note" style={{ marginTop: 8 }}>
              {board.seatsUsed} of {board.seatLimit} seats used. {Math.max(0, board.seatLimit - board.seatsUsed)} left.
                {' '}The plan is recorded. This page does not charge a card.
              </p>
              <p className="church-note">
                Plan status: {church.entitled ? 'active' : 'not active yet'}.
              </p>
              {church.testMarkPaid && !church.entitled && (
                <button className="church-button" type="button" onClick={markPaid} disabled={busy}>
                  {busy ? 'Please wait…' : 'Mark this test church paid'}
                </button>
              )}
            </section>
          </div>
        )}

        <h2 className="church-sign" style={{ fontSize: '1rem' }}>Seats</h2>
        {board && board.seats.length === 0 && (
          <section className="church-card">
            <p>No family has taken a seat yet.</p>
          </section>
        )}
        {board?.seats.map((seat) => (
          <article className="church-card church-seat" key={seat.id}>
            <h2 style={{ margin: 0 }}>{seat.familyName}</h2>
            <div className="church-meta">
              <span className="church-pill">1 family seat</span>
              {seat.apps.map((app) => <span className="church-pill" key={app}>{appLabel(app)}</span>)}
              {seat.email && <span className="church-pill">{seat.email}</span>}
            </div>
            {!seat.kidsStored && (
              <p className="church-note" style={{ marginTop: 8 }}>No kid profiles are stored for this family yet.</p>
            )}
            {seat.kids.map((kid) => (
              <div className="church-kid" key={kid.id || kid.name}>
                <h3>{kid.name}{typeof kid.age === 'number' ? `, age ${kid.age}` : ''}</h3>
                {kid.bible.nothingStored && <p className="church-note">No Bible progress is stored for this child yet.</p>}
                {kid.bible.creationWeek && (
                  <p>Creation Week: {kid.bible.creationWeek.finished} of {kid.bible.creationWeek.total} days
                    {kid.bible.creationWeek.daysFinished.length ? ` (${kid.bible.creationWeek.daysFinished.join(', ')})` : ''}.
                  </p>
                )}
                {kid.bible.weeks.map((week) => (
                  <p key={week.id}>{week.title}: {week.finished} of {week.total} days
                    {week.daysFinished.length ? ` (${week.daysFinished.join(', ')})` : ''}.
                  </p>
                ))}
                {kid.bible.bibleMapStoriesRead.length > 0 && (
                  <p>Bible Map stories marked read: {kid.bible.bibleMapStoriesRead.join(', ')}.</p>
                )}
              </div>
            ))}
            <p className="church-note" style={{ marginTop: 8 }}>{seat.bibleGap}</p>
          </article>
        ))}
      </div>
    </div>
  );
};

export default ChurchDashboardPage;

import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import '../style/interview.scss'

const MockInterview = () => {
    const { sessionId } = useParams()
    const navigate = useNavigate()
    const [session, setSession] = useState(null)
    const [answer, setAnswer] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const token = localStorage.getItem('token')
                const resp = await fetch(`http://localhost:3000/api/interview/mock/${sessionId}`, {
                    headers: {
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                })
                const data = await resp.json()
                if (!resp.ok) throw new Error(data?.message || 'Failed to load session')
                setSession(data)
            } catch (err) {
                console.error(err)
                alert(err.message || 'Failed to load mock session')
            } finally {
                setLoading(false)
            }
        }
        if (sessionId) load()
    }, [sessionId])

    if (loading || !session) {
        return <main className='loading-screen'><h1>Loading mock interview...</h1></main>
    }

    if (session.completed) {
        return (
            <div className='interview-page'>
                <div className='interview-layout'>
                    <main className='interview-content'>
                        <div className='content-header'>
                            <h2>Mock Interview Complete</h2>
                            <span className='content-header__count'>Average Score: {session.averageScore}%</span>
                        </div>

                        <section>
                            <h3>Your Answers</h3>
                            <ul>
                                {session.answers.map((a, i) => (
                                    <li key={i} style={{ marginBottom: '0.8rem' }}>
                                        <strong>Q{i+1}:</strong> {a.question}
                                        <div><strong>Your answer:</strong> {a.answer}</div>
                                        <div><strong>Score:</strong> {session.scores[i]?.score} %</div>
                                        <div><strong>Feedback:</strong> {session.scores[i]?.feedback}</div>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <div style={{ marginTop: '1rem' }}>
                            <button className='button' onClick={() => navigate(-1)}>Back</button>
                        </div>
                    </main>
                </div>
            </div>
        )
    }

    return (
        <div className='interview-page'>
            <div className='interview-layout'>
                <main className='interview-content'>
                    <div className='content-header'>
                        <h2>Mock Interview</h2>
                        <span className='content-header__count'>{session.currentIndex + 1} / {session.totalQuestions}</span>
                    </div>

                    <section>
                        <div className='q-card'>
                            <div className='q-card__header'>
                                <p className='q-card__question'>{session.currentQuestion?.question}</p>
                            </div>
                            <div className='q-card__body'>
                                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={8} style={{ width: '100%' }} placeholder='Type your answer here...' />
                                <div style={{ marginTop: '0.8rem', display: 'flex', gap: '0.5rem' }}>
                                    <button className='button primary-button' disabled={submitting || !answer.trim()} onClick={async () => {
                                        setSubmitting(true)
                                        try {
                                            const token = localStorage.getItem('token')
                                            const resp = await fetch(`http://localhost:3000/api/interview/mock/${sessionId}/answer`, {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                                },
                                                body: JSON.stringify({ answer })
                                            })
                                            const data = await resp.json()
                                            if (!resp.ok) throw new Error(data?.message || 'Failed to submit answer')
                                            const updatedResp = await fetch(`http://localhost:3000/api/interview/mock/${sessionId}`, {
                                                headers: {
                                                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                                }
                                            })
                                            const updated = await updatedResp.json()
                                            if (!updatedResp.ok) throw new Error(updated?.message || 'Failed to load session')
                                            setSession(updated)
                                            setAnswer('')
                                        } catch (err) {
                                            console.error(err)
                                            alert(err.message || 'Failed to submit answer')
                                        } finally {
                                            setSubmitting(false)
                                        }
                                    }}>Submit Answer</button>
                                    <button className='button' onClick={() => navigate(-1)}>Exit</button>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                            <h4>Previous Feedback</h4>
                            <ul>
                                {session.scores.map((s, i) => (
                                    <li key={i}><strong>Q{i+1}:</strong> {s.score}% — {s.feedback}</li>
                                ))}
                            </ul>
                        </div>
                    </section>
                </main>

                <aside className='interview-sidebar'>
                    <div className='match-score'>
                        <p className='match-score__label'>Live Average</p>
                        <div className={`match-score__ring ${session.averageScore >= 80 ? 'score--high' : session.averageScore >= 60 ? 'score--mid' : 'score--low'}`}>
                            <span className='match-score__value'>{session.averageScore}</span>
                            <span className='match-score__pct'>%</span>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    )
}

export default MockInterview
import React, { useEffect, useRef } from 'react';

const Alerts = ({ isAlert, isWarning }) => {
    const audioCtxRef = useRef(null);

    const ensureAudioContext = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtxRef.current;
    };

    const playBeep = (frequencyStart, frequencyEnd, duration, volume) => {
        const ctx = ensureAudioContext();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(frequencyStart, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(frequencyEnd, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);
    };

    useEffect(() => {
        let interval;

        if (isAlert) {
            // Strong alert (drowsy): repeating buzzer
            const strongBeep = () => playBeep(440, 880, 0.5, 0.5);
            strongBeep();
            interval = setInterval(strongBeep, 900);

            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }
        } else if (isWarning) {
            // Mild, calm warning: single softer beep on transition
            playBeep(440, 660, 0.35, 0.25);
        }

        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [isAlert, isWarning]);

    return null; // Invisible component
};

export default Alerts;

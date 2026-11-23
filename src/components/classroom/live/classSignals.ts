"use client";

import * as React from "react";
import { RoomEvent, type Participant, type Room } from "livekit-client";
import { readMeta, REACTIONS, TOPIC } from "@/lib/classroom";

/*
 * Raise hand and quick reactions, over the class data channel. Each person speaks only for themselves (a
 * message about someone else is ignored), except that the host may lower anyone's hand. Reactions are one
 * emoji from a fixed list, so nothing typed travels this way. A raised hand is sent again to people who join.
 */

export type Reaction = { id: number; identity: string; emoji: string };

const encode = (msg: Record<string, unknown>) => new TextEncoder().encode(JSON.stringify(msg));

/** `onRaised`: someone else just raised their hand (to say so on this screen). */
export function useClassSignals(room: Room, me: { identity: string }, onRaised?: (participant: Participant) => void) {
  const onRaisedRef = React.useRef(onRaised);
  React.useEffect(() => {
    onRaisedRef.current = onRaised;
  }, [onRaised]);
  const handsRef = React.useRef(new Set<string>());
  const [hands, setHands] = React.useState<Map<string, number>>(new Map());
  const [reactions, setReactions] = React.useState<Reaction[]>([]);
  const seq = React.useRef(0);
  const lastReact = React.useRef(new Map<string, number>());
  const myHandUp = hands.has(me.identity);
  const myHandRef = React.useRef(false);
  React.useEffect(() => {
    myHandRef.current = myHandUp;
  }, [myHandUp]);

  const setHand = React.useCallback((identity: string, up: boolean) => {
    if (up) handsRef.current.add(identity);
    else handsRef.current.delete(identity);
    setHands((h) => {
      if (up === h.has(identity)) return h;
      const next = new Map(h);
      if (up) next.set(identity, Date.now());
      else next.delete(identity);
      return next;
    });
  }, []);

  const show = React.useCallback((identity: string, emoji: string) => {
    const id = ++seq.current;
    setReactions((r) => [...r.slice(-11), { id, identity, emoji }]);
    window.setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 3500);
  }, []);

  React.useEffect(() => {
    const onData = (payload: Uint8Array, participant?: Participant) => {
      if (!participant) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
      } catch {
        return;
      }
      if (msg.type === TOPIC.hand) {
        const target = typeof msg.target === "string" ? msg.target : participant.identity;
        // Only about yourself, or the host lowering someone's hand.
        if (target !== participant.identity && !(readMeta(participant.metadata)?.isHost && msg.up === false)) return;
        if (msg.up === true && !handsRef.current.has(target) && target !== me.identity) onRaisedRef.current?.(participant);
        setHand(target, msg.up === true);
      } else if (msg.type === TOPIC.react) {
        const emoji = String(msg.emoji ?? "");
        if (!(REACTIONS as readonly string[]).includes(emoji)) return;
        // One a second per person at most on this screen.
        const now = Date.now();
        if (now - (lastReact.current.get(participant.identity) ?? 0) < 1000) return;
        lastReact.current.set(participant.identity, now);
        show(participant.identity, emoji);
      }
    };
    const onJoin = () => {
      if (myHandRef.current) room.localParticipant.publishData(encode({ type: TOPIC.hand, up: true }), { reliable: true }).catch(() => {});
    };
    const onLeave = (p: Participant) => setHand(p.identity, false);
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantConnected, onJoin);
    room.on(RoomEvent.ParticipantDisconnected, onLeave);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantConnected, onJoin);
      room.off(RoomEvent.ParticipantDisconnected, onLeave);
    };
  }, [room, me.identity, setHand, show]);

  const toggleHand = React.useCallback(() => {
    const up = !myHandRef.current;
    setHand(me.identity, up);
    room.localParticipant.publishData(encode({ type: TOPIC.hand, up }), { reliable: true }).catch(() => {});
  }, [room, me.identity, setHand]);

  /** The host lowers someone's hand (everyone's screen accepts it from the host only). */
  const lowerHand = React.useCallback(
    (identity: string) => {
      setHand(identity, false);
      room.localParticipant.publishData(encode({ type: TOPIC.hand, up: false, target: identity }), { reliable: true }).catch(() => {});
    },
    [room, setHand],
  );

  const react = React.useCallback(
    (emoji: (typeof REACTIONS)[number]) => {
      const now = Date.now();
      if (now - (lastReact.current.get(me.identity) ?? 0) < 1000) return;
      lastReact.current.set(me.identity, now);
      show(me.identity, emoji);
      room.localParticipant.publishData(encode({ type: TOPIC.react, emoji }), { reliable: false }).catch(() => {});
    },
    [room, me.identity, show],
  );

  return { hands, myHandUp, toggleHand, lowerHand, reactions, react };
}

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabaseService';
import { FriendlyRoom, TauntItem, User, Friend } from '../types';

type DuelEventHandler = (event: {
  type: 'PLAYER_JOINED' | 'GAME_START' | 'TAUNT_TRIGGERED' | 'OPPONENT_PROGRESS' | 'OPPONENT_FINISHED' | 'OPPONENT_LEFT';
  payload: any;
}) => void;

export class FriendlyBattleService {
  private static activeChannel: RealtimeChannel | null = null;
  private static currentRoomCode: string | null = null;

  /**
   * Generate a random 4-digit room code
   */
  static generateRoomCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Host / Create a new Friendly Duel Room
   */
  static createRoom(
    roomCode: string,
    host: User | Friend,
    classNum: number,
    subject: string,
    onEvent: DuelEventHandler
  ): FriendlyRoom {
    this.leaveCurrentRoom();
    this.currentRoomCode = roomCode;

    const room: FriendlyRoom = {
      roomCode,
      hostUid: host.uid,
      hostName: host.name || 'Player',
      hostAvatar: host.avatar || '🎓',
      hostTag: (host as any).arenaTag || '#AA-0000',
      classNum,
      subject,
      status: 'waiting',
      createdAt: Date.now(),
    };

    const channel = supabase.channel(`arena_duel_${roomCode}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'PLAYER_JOINED' }, (res: any) => {
        onEvent({ type: 'PLAYER_JOINED', payload: res.payload });
      })
      .on('broadcast', { event: 'GAME_START' }, (res: any) => {
        onEvent({ type: 'GAME_START', payload: res.payload });
      })
      .on('broadcast', { event: 'TAUNT_TRIGGERED' }, (res: any) => {
        onEvent({ type: 'TAUNT_TRIGGERED', payload: res.payload });
      })
      .on('broadcast', { event: 'OPPONENT_PROGRESS' }, (res: any) => {
        onEvent({ type: 'OPPONENT_PROGRESS', payload: res.payload });
      })
      .on('broadcast', { event: 'OPPONENT_FINISHED' }, (res: any) => {
        onEvent({ type: 'OPPONENT_FINISHED', payload: res.payload });
      })
      .on('broadcast', { event: 'OPPONENT_LEFT' }, (res: any) => {
        onEvent({ type: 'OPPONENT_LEFT', payload: res.payload });
      })
      .subscribe();

    this.activeChannel = channel;
    return room;
  }

  /**
   * Join an existing Friendly Duel Room by code
   */
  static async joinRoom(
    roomCode: string,
    guest: User | Friend,
    onEvent: DuelEventHandler
  ): Promise<boolean> {
    this.leaveCurrentRoom();
    this.currentRoomCode = roomCode;

    const channel = supabase.channel(`arena_duel_${roomCode}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'GAME_START' }, (res: any) => {
        onEvent({ type: 'GAME_START', payload: res.payload });
      })
      .on('broadcast', { event: 'TAUNT_TRIGGERED' }, (res: any) => {
        onEvent({ type: 'TAUNT_TRIGGERED', payload: res.payload });
      })
      .on('broadcast', { event: 'OPPONENT_PROGRESS' }, (res: any) => {
        onEvent({ type: 'OPPONENT_PROGRESS', payload: res.payload });
      })
      .on('broadcast', { event: 'OPPONENT_FINISHED' }, (res: any) => {
        onEvent({ type: 'OPPONENT_FINISHED', payload: res.payload });
      })
      .on('broadcast', { event: 'OPPONENT_LEFT' }, (res: any) => {
        onEvent({ type: 'OPPONENT_LEFT', payload: res.payload });
      })
      .subscribe(async (status: any) => {
        if (status === 'SUBSCRIBED') {
          // Announce guest joined
          await channel.send({
            type: 'broadcast',
            event: 'PLAYER_JOINED',
            payload: {
              guestUid: guest.uid,
              guestName: guest.name || 'Challenger',
              guestAvatar: guest.avatar || '⚡',
              guestTag: (guest as any).arenaTag || '#AA-0000',
            },
          });
        }
      });

    this.activeChannel = channel;
    return true;
  }

  /**
   * Start Match (Host broadcasts start)
   */
  static async startMatch(questions: any[]): Promise<void> {
    if (this.activeChannel) {
      await this.activeChannel.send({
        type: 'broadcast',
        event: 'GAME_START',
        payload: { questions, startTime: Date.now() },
      });
    }
  }

  /**
   * Broadcast a Taunt or Meme text during battle
   */
  static async sendTaunt(taunt: {
    senderName: string;
    senderAvatar: string;
    tauntItem: TauntItem;
  }): Promise<void> {
    if (this.activeChannel) {
      await this.activeChannel.send({
        type: 'broadcast',
        event: 'TAUNT_TRIGGERED',
        payload: taunt,
      });
    }
  }

  /**
   * Broadcast real-time match progress (score, question index, hearts, streak)
   */
  static async sendProgress(progress: {
    uid: string;
    score: number;
    questionIndex: number;
    hearts: number;
    streak: number;
  }): Promise<void> {
    if (this.activeChannel) {
      await this.activeChannel.send({
        type: 'broadcast',
        event: 'OPPONENT_PROGRESS',
        payload: progress,
      });
    }
  }

  /**
   * Broadcast match completion
   */
  static async sendFinish(finishData: {
    uid: string;
    score: number;
    expEarned: number;
    won: boolean;
  }): Promise<void> {
    if (this.activeChannel) {
      await this.activeChannel.send({
        type: 'broadcast',
        event: 'OPPONENT_FINISHED',
        payload: finishData,
      });
    }
  }

  /**
   * Clean up and leave current room
   */
  static leaveCurrentRoom(): void {
    if (this.activeChannel) {
      this.activeChannel.send({
        type: 'broadcast',
        event: 'OPPONENT_LEFT',
        payload: {},
      }).catch(() => {});
      supabase.removeChannel(this.activeChannel);
      this.activeChannel = null;
      this.currentRoomCode = null;
    }
  }
}

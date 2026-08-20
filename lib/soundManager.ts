import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_ENABLED_KEY = '@app_sound_enabled';
const SFX_VOLUME_KEY = '@app_sfx_volume';

// Complete suite of 12 bundled offline sound assets for 0ms zero-latency playback
const LOCAL_SOUNDS = {
  // Wrong answers (Meme + Arcade)
  wrongFart: require('../assets/sounds/wrong_fart.wav'),
  wrongFaah: require('../assets/sounds/wrong_faah.wav'),
  wrongBuzzer: require('../assets/sounds/wrong_buzzer.wav'),
  wrongWomp: require('../assets/sounds/wrong_womp.wav'),

  // Correct answers (Meme + Bell + Chimes + Sparkles)
  correctBhangra: require('../assets/sounds/correct_bhangra.wav'),
  correctBell: require('../assets/sounds/correct_bell.wav'),
  correctChime: require('../assets/sounds/correct_chime.wav'),
  correctSparkle: require('../assets/sounds/correct_sparkle.wav'),

  // Battle surges & match results
  animeMuda: require('../assets/sounds/anime_muda.wav'),
  victoryFanfare: require('../assets/sounds/victory_fanfare.wav'),
  defeatGameover: require('../assets/sounds/defeat_gameover.wav'),

  // Continuous background music
  bgm: require('../assets/sounds/bgm_arena.wav'),
};

class SoundManager {
  private enabled: boolean = true;
  private volume: number = 0.8;
  private isSettingsLoaded: boolean = false;
  private activePlayers: AudioPlayer[] = [];
  private bgmPlayer: AudioPlayer | null = null;
  private isBgmPlaying: boolean = false;

  private async ensureSettingsLoaded() {
    if (this.isSettingsLoaded) return;
    try {
      const [storedEnabled, storedVolume] = await Promise.all([
        AsyncStorage.getItem(SOUND_ENABLED_KEY),
        AsyncStorage.getItem(SFX_VOLUME_KEY),
      ]);
      if (storedEnabled !== null) {
        this.enabled = storedEnabled === 'true';
      }
      if (storedVolume !== null) {
        this.volume = parseFloat(storedVolume) || 0.8;
      }
      this.isSettingsLoaded = true;
    } catch (e) {
      this.isSettingsLoaded = true;
    }
  }

  public async setSoundEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopBgm();
    }
    try {
      await AsyncStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
    } catch (e) {}
  }

  public getSoundEnabled(): boolean {
    return this.enabled;
  }

  public async setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.bgmPlayer) {
      try {
        this.bgmPlayer.volume = this.volume * 0.45;
      } catch (e) {}
    }
    try {
      await AsyncStorage.setItem(SFX_VOLUME_KEY, String(this.volume));
    } catch (e) {}
  }

  public getVolume(): number {
    return this.volume;
  }

  private async playLocalAsset(source: any, customVolumeMultiplier = 1.0) {
    try {
      await this.ensureSettingsLoaded();
      if (!this.enabled) return;
      if (!createAudioPlayer) return;

      const player = createAudioPlayer(source);
      if (!player) return;

      player.volume = Math.min(1.0, this.volume * customVolumeMultiplier);
      player.play();

      this.activePlayers.push(player);

      // Clean up player after sound finishes
      setTimeout(() => {
        try {
          player.release();
          this.activePlayers = this.activePlayers.filter((p) => p !== player);
        } catch (releaseErr) {}
      }, 5000);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // ─── BACKGROUND MUSIC ───
  public async startBgm() {
    try {
      await this.ensureSettingsLoaded();
      if (!this.enabled) return;
      if (this.isBgmPlaying && this.bgmPlayer) return;

      if (!createAudioPlayer) return;

      this.bgmPlayer = createAudioPlayer(LOCAL_SOUNDS.bgm);
      if (!this.bgmPlayer) return;

      this.bgmPlayer.loop = true;
      this.bgmPlayer.volume = Math.min(1.0, this.volume * 0.4);
      this.bgmPlayer.play();
      this.isBgmPlaying = true;
    } catch (e) {
      console.warn('BGM start error:', e);
    }
  }

  public stopBgm() {
    try {
      if (this.bgmPlayer) {
        this.bgmPlayer.pause();
        this.bgmPlayer.release();
        this.bgmPlayer = null;
      }
      this.isBgmPlaying = false;
    } catch (e) {
      console.warn('BGM stop error:', e);
    }
  }

  // ─── CORRECT ANSWER SOUNDS ───
  // Cycles through Bhangra Beat, Soothing Bell, Classic Arcade Chime, Sparkle Ding
  public async playCorrect() {
    const list = [
      LOCAL_SOUNDS.correctBhangra,
      LOCAL_SOUNDS.correctBell,
      LOCAL_SOUNDS.correctChime,
      LOCAL_SOUNDS.correctSparkle,
    ];
    const pick = list[Math.floor(Math.random() * list.length)];
    await this.playLocalAsset(pick, 1.0);
  }

  public async playBhangraTune() {
    await this.playLocalAsset(LOCAL_SOUNDS.correctBhangra, 1.0);
  }

  public async playSoothingBell() {
    await this.playLocalAsset(LOCAL_SOUNDS.correctBell, 0.95);
  }

  public async playChime() {
    await this.playLocalAsset(LOCAL_SOUNDS.correctChime, 1.0);
  }

  public async playSparkle() {
    await this.playLocalAsset(LOCAL_SOUNDS.correctSparkle, 1.0);
  }

  // ─── WRONG ANSWER SOUNDS ───
  // Cycles through Funny Fart, "Faah!" Vocal, Classic Buzzer, "Womp Womp"
  public async playWrong() {
    const list = [
      LOCAL_SOUNDS.wrongFart,
      LOCAL_SOUNDS.wrongFaah,
      LOCAL_SOUNDS.wrongBuzzer,
      LOCAL_SOUNDS.wrongWomp,
    ];
    const pick = list[Math.floor(Math.random() * list.length)];
    await this.playLocalAsset(pick, 1.0);
  }

  public async playFart() {
    await this.playLocalAsset(LOCAL_SOUNDS.wrongFart, 1.0);
  }

  public async playFaah() {
    await this.playLocalAsset(LOCAL_SOUNDS.wrongFaah, 1.0);
  }

  public async playBuzzer() {
    await this.playLocalAsset(LOCAL_SOUNDS.wrongBuzzer, 1.0);
  }

  public async playWomp() {
    await this.playLocalAsset(LOCAL_SOUNDS.wrongWomp, 1.0);
  }

  // ─── SPECIAL SURGES & FINISHES ───
  public async playMudaMuda() {
    await this.playLocalAsset(LOCAL_SOUNDS.animeMuda, 1.0);
  }

  public async playVictory() {
    await this.playLocalAsset(LOCAL_SOUNDS.victoryFanfare, 1.0);
  }

  public async playDefeat() {
    await this.playLocalAsset(LOCAL_SOUNDS.defeatGameover, 1.0);
  }
}

export const soundManager = new SoundManager();

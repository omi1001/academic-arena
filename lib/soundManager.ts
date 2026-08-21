import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_ENABLED_KEY = '@app_sound_enabled';
const SFX_VOLUME_KEY = '@app_sfx_volume';
const BGM_VOLUME_KEY = '@app_bgm_volume';

// Sound Suite Assets
const LOCAL_SOUNDS = {
  // Correct answers
  correct: require('../assets/sounds/correct.mp3'),
  iGotThis: require('../assets/sounds/i_got_this.mp3'),

  // Wrong answers & meme fails
  fah: require('../assets/sounds/fah.mp3'),
  fart4: require('../assets/sounds/fart_4.mp3'),
  thud: require('../assets/sounds/thud.mp3'),
  goofyHorn: require('../assets/sounds/goofy_ahh_car_horn.mp3'),
  wooooah: require('../assets/sounds/woooooaah.mp3'),

  // Dynamic Theme Background Music
  bgmSuzume: require('../assets/sounds/bgm_suzume.mp3'),
  bgmSpace: require('../assets/sounds/bgm_space.mp3'),
  bgmDrill: require('../assets/sounds/bgm_drill.mp3'),
  bgmBirds: require('../assets/sounds/bgm_birds.mp3'),
};

const THEME_BGM_MAP: Record<string, any> = {
  sakura_zen: LOCAL_SOUNDS.bgmSuzume,
  cosmic_lofi: LOCAL_SOUNDS.bgmSpace,
  cyber_neon: LOCAL_SOUNDS.bgmDrill,
  botanical_calm: LOCAL_SOUNDS.bgmBirds,
  ember_arena: LOCAL_SOUNDS.bgmDrill,
};

class SoundManager {
  private enabled: boolean = true;
  private sfxVolume: number = 0.85;
  private bgmVolume: number = 0.55;
  private isSettingsLoaded: boolean = false;
  private activePlayers: AudioPlayer[] = [];

  // BGM state
  private bgmPlayer: AudioPlayer | null = null;
  private currentBgmKey: string | null = null;
  private isBgmPausedForGame: boolean = false;

  private async ensureSettingsLoaded() {
    if (this.isSettingsLoaded) return;
    try {
      const [storedEnabled, storedSfx, storedBgm] = await Promise.all([
        AsyncStorage.getItem(SOUND_ENABLED_KEY),
        AsyncStorage.getItem(SFX_VOLUME_KEY),
        AsyncStorage.getItem(BGM_VOLUME_KEY),
      ]);
      if (storedEnabled !== null) {
        this.enabled = storedEnabled === 'true';
      }
      if (storedSfx !== null) {
        this.sfxVolume = parseFloat(storedSfx) || 0.85;
      }
      if (storedBgm !== null) {
        this.bgmVolume = parseFloat(storedBgm) || 0.55;
      }
      this.isSettingsLoaded = true;
    } catch (e) {
      this.isSettingsLoaded = true;
    }
  }

  public async setSoundEnabled(enabled: boolean) {
    this.enabled = enabled;
    try {
      await AsyncStorage.setItem(SOUND_ENABLED_KEY, enabled.toString());
      if (!enabled) {
        this.stopBgm();
      } else if (this.currentBgmKey && !this.isBgmPausedForGame) {
        this.playThemeBgm(this.currentBgmKey);
      }
    } catch (e) {}
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getSoundEnabled(): boolean {
    return this.enabled;
  }

  public async setSfxVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    try {
      await AsyncStorage.setItem(SFX_VOLUME_KEY, this.sfxVolume.toString());
    } catch (e) {}
  }

  public async setBgmVolume(volume: number) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.bgmPlayer) {
      try {
        this.bgmPlayer.volume = this.bgmVolume;
      } catch (e) {}
    }
    try {
      await AsyncStorage.setItem(BGM_VOLUME_KEY, this.bgmVolume.toString());
    } catch (e) {}
  }

  public getVolume(): number {
    return this.sfxVolume;
  }

  // ─── 🎵 DYNAMIC THEME BACKGROUND MUSIC ───

  public async playThemeBgm(presetKey: string) {
    try {
      await this.ensureSettingsLoaded();
      if (!this.enabled || this.isBgmPausedForGame) return;

      const trackAsset = THEME_BGM_MAP[presetKey] || LOCAL_SOUNDS.bgmSpace;

      // If already playing this exact track, don't restart
      if (this.currentBgmKey === presetKey && this.bgmPlayer) {
        return;
      }

      this.stopBgm();
      this.currentBgmKey = presetKey;

      const player = createAudioPlayer(trackAsset);
      player.volume = this.bgmVolume;
      player.loop = true;
      player.play();

      this.bgmPlayer = player;
    } catch (e) {
      console.warn('[SOUND MANAGER] BGM error:', e);
    }
  }

  public startBgm(presetKey?: string) {
    const key = presetKey || this.currentBgmKey || 'cosmic_lofi';
    this.isBgmPausedForGame = false;
    this.playThemeBgm(key);
  }

  public pauseBgm() {
    this.isBgmPausedForGame = true;
    try {
      if (this.bgmPlayer) {
        this.bgmPlayer.pause();
      }
    } catch (e) {}
  }

  public resumeBgm() {
    this.isBgmPausedForGame = false;
    try {
      if (this.enabled) {
        if (this.bgmPlayer) {
          this.bgmPlayer.play();
        } else if (this.currentBgmKey) {
          this.playThemeBgm(this.currentBgmKey);
        }
      }
    } catch (e) {}
  }

  public stopBgm() {
    try {
      if (this.bgmPlayer) {
        this.bgmPlayer.pause();
        this.bgmPlayer.release();
        this.bgmPlayer = null;
      }
    } catch (e) {}
  }

  // ─── 🔊 SFX PLAYBACK ───

  private async playLocalAsset(source: any, volumeMultiplier: number = 1.0) {
    try {
      await this.ensureSettingsLoaded();
      if (!this.enabled) return;

      const player = createAudioPlayer(source);
      player.volume = Math.max(0, Math.min(1, this.sfxVolume * volumeMultiplier));
      player.play();

      this.activePlayers.push(player);

      setTimeout(() => {
        try {
          player.release();
          this.activePlayers = this.activePlayers.filter((p) => p !== player);
        } catch (e) {}
      }, 5000);
    } catch (e) {
      console.warn('[SOUND MANAGER] SFX play error:', e);
    }
  }

  // ─── 🟢 CORRECT ANSWER SOUNDS ───
  public async playCorrect() {
    const list = [LOCAL_SOUNDS.correct, LOCAL_SOUNDS.iGotThis];
    const pick = list[Math.floor(Math.random() * list.length)];
    await this.playLocalAsset(pick, 1.0);
  }

  public async playIGotThis() {
    await this.playLocalAsset(LOCAL_SOUNDS.iGotThis, 1.0);
  }

  // ─── 🔴 WRONG ANSWER MEME SOUNDS ───
  public async playWrong() {
    const list = [
      LOCAL_SOUNDS.fah,
      LOCAL_SOUNDS.fart4,
      LOCAL_SOUNDS.thud,
      LOCAL_SOUNDS.goofyHorn,
      LOCAL_SOUNDS.wooooah,
    ];
    const pick = list[Math.floor(Math.random() * list.length)];
    await this.playLocalAsset(pick, 1.0);
  }

  public async playFah() {
    await this.playLocalAsset(LOCAL_SOUNDS.fah, 1.0);
  }

  public async playFart() {
    await this.playLocalAsset(LOCAL_SOUNDS.fart4, 1.0);
  }

  public async playThud() {
    await this.playLocalAsset(LOCAL_SOUNDS.thud, 1.0);
  }

  public async playWoo() {
    await this.playLocalAsset(LOCAL_SOUNDS.wooooah, 1.0);
  }

  // ─── 💀 DEFEAT / LOSS / GAME OVER SOUNDS ───
  public async playDefeat() {
    const list = [LOCAL_SOUNDS.fart4, LOCAL_SOUNDS.fah, LOCAL_SOUNDS.goofyHorn, LOCAL_SOUNDS.thud];
    const pick = list[Math.floor(Math.random() * list.length)];
    await this.playLocalAsset(pick, 1.0);
  }

  public async playGameOver() {
    const list = [LOCAL_SOUNDS.fart4, LOCAL_SOUNDS.fah, LOCAL_SOUNDS.goofyHorn, LOCAL_SOUNDS.thud];
    const pick = list[Math.floor(Math.random() * list.length)];
    await this.playLocalAsset(pick, 1.0);
  }

  public async playVictory() {
    await this.playLocalAsset(LOCAL_SOUNDS.iGotThis, 1.0);
  }

  public async playLevelUp() {
    await this.playLocalAsset(LOCAL_SOUNDS.iGotThis, 1.0);
  }

  public async playMudaMuda() {
    await this.playLocalAsset(LOCAL_SOUNDS.goofyHorn, 1.0);
  }

  public async playHorn() {
    await this.playLocalAsset(LOCAL_SOUNDS.goofyHorn, 1.0);
  }

  public async playTauntPop() {
    const list = [LOCAL_SOUNDS.goofyHorn, LOCAL_SOUNDS.fah, LOCAL_SOUNDS.fart4, LOCAL_SOUNDS.wooooah];
    const pick = list[Math.floor(Math.random() * list.length)];
    await this.playLocalAsset(pick, 1.0);
  }
}

export const soundManager = new SoundManager();

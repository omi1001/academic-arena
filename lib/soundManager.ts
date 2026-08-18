import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_ENABLED_KEY = '@app_sound_enabled';
const SFX_VOLUME_KEY = '@app_sfx_volume';

// Kid-friendly meme and game audio effects
const SOUND_EFFECTS = {
  correct: [
    'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
    'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
    'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
  ],
  wrong: [
    'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3',
    'https://assets.mixkit.co/active_storage/sfx/2574/2574-preview.mp3',
    'https://assets.mixkit.co/active_storage/sfx/2953/2953-preview.mp3',
  ],
  mudaMuda: [
    'https://assets.mixkit.co/active_storage/sfx/2744/2744-preview.mp3',
    'https://assets.mixkit.co/active_storage/sfx/2766/2766-preview.mp3',
  ],
  victory: [
    'https://assets.mixkit.co/active_storage/sfx/1433/1433-preview.mp3',
  ],
  defeat: [
    'https://assets.mixkit.co/active_storage/sfx/2954/2954-preview.mp3',
  ],
};

class SoundManager {
  private enabled: boolean = true;
  private volume: number = 0.8;
  private isAudioModeConfigured: boolean = false;
  private isSettingsLoaded: boolean = false;

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

  private async configureAudioMode() {
    if (this.isAudioModeConfigured) return;
    try {
      if (Audio && Audio.setAudioModeAsync) {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      }
      this.isAudioModeConfigured = true;
    } catch (e) {
      console.warn('Audio mode setup skipped:', e);
    }
  }

  public async setSoundEnabled(enabled: boolean) {
    this.enabled = enabled;
    try {
      await AsyncStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
    } catch (e) {}
  }

  public getSoundEnabled(): boolean {
    return this.enabled;
  }

  public async setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    try {
      await AsyncStorage.setItem(SFX_VOLUME_KEY, String(this.volume));
    } catch (e) {}
  }

  public getVolume(): number {
    return this.volume;
  }

  private async playSoundFromUrl(url: string) {
    try {
      await this.ensureSettingsLoaded();
      if (!this.enabled) return;

      await this.configureAudioMode();

      if (!Audio || !Audio.Sound) return;

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: this.volume }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      // Non-blocking warning so audio failure never crashes the game loop
      console.warn('Audio playback caught error:', e);
    }
  }

  public async playCorrect() {
    const list = SOUND_EFFECTS.correct;
    const url = list[Math.floor(Math.random() * list.length)];
    await this.playSoundFromUrl(url);
  }

  public async playWrong() {
    const list = SOUND_EFFECTS.wrong;
    const url = list[Math.floor(Math.random() * list.length)];
    await this.playSoundFromUrl(url);
  }

  public async playMudaMuda() {
    const list = SOUND_EFFECTS.mudaMuda;
    const url = list[Math.floor(Math.random() * list.length)];
    await this.playSoundFromUrl(url);
  }

  public async playVictory() {
    await this.playSoundFromUrl(SOUND_EFFECTS.victory[0]);
  }

  public async playDefeat() {
    await this.playSoundFromUrl(SOUND_EFFECTS.defeat[0]);
  }
}

export const soundManager = new SoundManager();

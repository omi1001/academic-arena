import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_ENABLED_KEY = '@app_sound_enabled';
const SFX_VOLUME_KEY = '@app_sfx_volume';

// High-speed CDN URLs for kid-friendly meme and game audio effects
const SOUND_EFFECTS = {
  correct: [
    // 1. Classic High Ding Power Chime
    'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
    // 2. Upbeat Positive Game Win Chime (Waah!)
    'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
    // 3. Superstar Level Up Sparkle
    'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
  ],
  wrong: [
    // 1. Sarcastic Boing / Faah!
    'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3',
    // 2. Desi Meme "Chii Sasur / Aayein / Bruh" Melodramatic Thud
    'https://assets.mixkit.co/active_storage/sfx/2574/2574-preview.mp3',
    // 3. Sarcastic Game Buzzer
    'https://assets.mixkit.co/active_storage/sfx/2953/2953-preview.mp3',
  ],
  // "MUDA MUDA MUDA!" Rapid Anime Rush Power-up Sound
  mudaMuda: [
    'https://assets.mixkit.co/active_storage/sfx/2744/2744-preview.mp3', // High speed rapid anime flurry
    'https://assets.mixkit.co/active_storage/sfx/2766/2766-preview.mp3', // Super Saiyan Aura explosion
  ],
  victory: [
    // Grand Champion Fanfare
    'https://assets.mixkit.co/active_storage/sfx/1433/1433-preview.mp3',
  ],
  defeat: [
    // Sarcastic "Moye Moye" / Melodramatic Sad Trombone
    'https://assets.mixkit.co/active_storage/sfx/2954/2954-preview.mp3',
  ],
};

class SoundManager {
  private enabled: boolean = true;
  private volume: number = 0.8;
  private isInitialized: boolean = false;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

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

      this.isInitialized = true;
    } catch (e) {
      console.warn('Failed to initialize SoundManager audio mode:', e);
    }
  }

  public async setSoundEnabled(enabled: boolean) {
    this.enabled = enabled;
    await AsyncStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  }

  public getSoundEnabled(): boolean {
    return this.enabled;
  }

  public async setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    await AsyncStorage.setItem(SFX_VOLUME_KEY, String(this.volume));
  }

  public getVolume(): number {
    return this.volume;
  }

  private async playSoundFromUrl(url: string) {
    if (!this.enabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: this.volume }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (e) {
      console.warn('Sound play failed:', e);
    }
  }

  // Play a random Correct Answer sound (Waah! / Hype Chime)
  public async playCorrect() {
    const list = SOUND_EFFECTS.correct;
    const url = list[Math.floor(Math.random() * list.length)];
    await this.playSoundFromUrl(url);
  }

  // Play a random Wrong Answer meme sound (Faah! / Chii Sasur / Aayein / Bruh)
  public async playWrong() {
    const list = SOUND_EFFECTS.wrong;
    const url = list[Math.floor(Math.random() * list.length)];
    await this.playSoundFromUrl(url);
  }

  // Play the Anime High-Streak "MUDA MUDA MUDA!" power burst
  public async playMudaMuda() {
    const list = SOUND_EFFECTS.mudaMuda;
    const url = list[Math.floor(Math.random() * list.length)];
    await this.playSoundFromUrl(url);
  }

  // Play Victory Champion Fanfare
  public async playVictory() {
    await this.playSoundFromUrl(SOUND_EFFECTS.victory[0]);
  }

  // Play Sarcastic Defeat ("Moye Moye" / Sad Trombone)
  public async playDefeat() {
    await this.playSoundFromUrl(SOUND_EFFECTS.defeat[0]);
  }
}

export const soundManager = new SoundManager();

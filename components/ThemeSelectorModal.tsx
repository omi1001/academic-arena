import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useThemeStore } from '../stores/themeStore';
import { THEME_PRESETS, ThemePresetKey } from '../constants/themes';
import { soundManager } from '../lib/soundManager';
import { BouncyButton } from './BouncyButton';

interface ThemeSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  visible,
  onClose,
}) => {
  const { mode, presetKey, setMode, setPreset, customWallpaper, setCustomWallpaper, getColors } = useThemeStore();
  const colors = getColors();

  const [soundEnabled, setSoundEnabledState] = useState(() => soundManager.getSoundEnabled());
  const [bgmVol, setBgmVol] = useState(() => soundManager.getBgmVolume());
  const [sfxVol, setSfxVol] = useState(() => soundManager.getSfxVolume());
  const [customUrlInput, setCustomUrlInput] = useState(customWallpaper || '');

  const handleToggleSound = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !soundEnabled;
    setSoundEnabledState(next);
    await soundManager.setSoundEnabled(next);
    if (next) {
      soundManager.playCorrect();
    }
  };

  const handleSetBgmVolume = async (vol: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBgmVol(vol);
    await soundManager.setBgmVolume(vol);
  };

  const handleSetSfxVolume = async (vol: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSfxVol(vol);
    await soundManager.setSfxVolume(vol);
    if (vol > 0) {
      soundManager.playCorrect();
    }
  };

  const handleSelectPreset = (key: ThemePresetKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPreset(key);
  };

  const handleToggleMode = (selectedMode: 'dark' | 'light') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(selectedMode);
  };

  const handleApplyCustomWallpaper = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (customUrlInput.trim()) {
      setCustomWallpaper(customUrlInput.trim());
    } else {
      setCustomWallpaper(null);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>🎨 Theme & Atmosphere</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Customize visuals, mode & background music
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Light / Dark Mode Toggle */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>🌓 Display Mode</Text>
            <View style={styles.modeToggleRow}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === 'dark' && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => handleToggleMode('dark')}
              >
                <Text style={[styles.modeButtonText, mode === 'dark' && styles.activeModeText]}>
                  🌙 Dark Mode
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === 'light' && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => handleToggleMode('light')}
              >
                <Text style={[styles.modeButtonText, mode === 'light' && styles.activeModeText]}>
                  ☀️ Light Mode
                </Text>
              </TouchableOpacity>
            </View>

            {/* Master Audio Toggle */}
            <View style={styles.soundRow}>
              <View>
                <Text style={[styles.soundTitle, { color: colors.text }]}>🔊 Master Audio</Text>
                <Text style={[styles.soundSubtitle, { color: colors.textMuted }]}>
                  Soundtracks & meme taunts
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.soundToggleBtn,
                  soundEnabled ? { backgroundColor: '#10B981' } : { backgroundColor: '#6B7280' },
                ]}
                onPress={handleToggleSound}
              >
                <Text style={styles.soundToggleText}>{soundEnabled ? 'ON' : 'MUTED'}</Text>
              </TouchableOpacity>
            </View>

            {/* Background Music (BGM) Volume */}
            <View style={styles.volumeCard}>
              <View style={styles.volumeHeader}>
                <Text style={[styles.volumeTitle, { color: colors.text }]}>🎵 Music Volume (BGM)</Text>
                <Text style={[styles.volumePercentText, { color: colors.primary }]}>
                  {Math.round(bgmVol * 100)}%
                </Text>
              </View>
              <View style={styles.volumePillsRow}>
                {[
                  { label: 'OFF 🔇', val: 0.0 },
                  { label: '30% 🔈', val: 0.3 },
                  { label: '60% 🔉', val: 0.6 },
                  { label: '90% 🔊', val: 0.9 },
                ].map((tier) => {
                  const isSelected = Math.abs(bgmVol - tier.val) < 0.12;
                  return (
                    <TouchableOpacity
                      key={tier.label}
                      style={[
                        styles.volumePill,
                        isSelected
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(255, 255, 255, 0.12)' },
                      ]}
                      onPress={() => handleSetBgmVolume(tier.val)}
                    >
                      <Text
                        style={[
                          styles.volumePillText,
                          isSelected && styles.activeModeText,
                        ]}
                      >
                        {tier.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Meme SFX Volume */}
            <View style={[styles.volumeCard, { marginTop: 10 }]}>
              <View style={styles.volumeHeader}>
                <Text style={[styles.volumeTitle, { color: colors.text }]}>💥 Meme SFX Volume</Text>
                <Text style={[styles.volumePercentText, { color: colors.secondary }]}>
                  {Math.round(sfxVol * 100)}%
                </Text>
              </View>
              <View style={styles.volumePillsRow}>
                {[
                  { label: 'OFF 🔇', val: 0.0 },
                  { label: '40% 🔈', val: 0.4 },
                  { label: '70% 🔉', val: 0.7 },
                  { label: '100% 🔊', val: 1.0 },
                ].map((tier) => {
                  const isSelected = Math.abs(sfxVol - tier.val) < 0.12;
                  return (
                    <TouchableOpacity
                      key={tier.label}
                      style={[
                        styles.volumePill,
                        isSelected
                          ? { backgroundColor: colors.secondary, borderColor: colors.secondary }
                          : { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(255, 255, 255, 0.12)' },
                      ]}
                      onPress={() => handleSetSfxVolume(tier.val)}
                    >
                      <Text
                        style={[
                          styles.volumePillText,
                          isSelected && styles.activeModeText,
                        ]}
                      >
                        {tier.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Presets & Wallpapers */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>
              🖼️ Aesthetic Wallpapers & Soundtracks
            </Text>
            <View style={styles.presetList}>
              {(Object.keys(THEME_PRESETS) as ThemePresetKey[]).map((key) => {
                const item = THEME_PRESETS[key];
                const isSelected = presetKey === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.presetItem,
                      { borderColor: isSelected ? colors.primary : colors.border },
                      isSelected && styles.presetItemSelected,
                    ]}
                    onPress={() => handleSelectPreset(key)}
                  >
                    <Image source={{ uri: item.wallpaperUrl }} style={styles.presetImage} />
                    <View style={styles.presetOverlay}>
                      <Text style={styles.presetEmoji}>{item.emoji}</Text>
                      <Text style={styles.presetName}>{item.name}</Text>
                      {isSelected && (
                        <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}>
                          <Text style={styles.activeBadgeText}>ACTIVE</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Wallpaper URL Input */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>
              🔗 Custom Wallpaper URL (Optional)
            </Text>
            <View style={styles.customUrlBox}>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="https://example.com/cute-wallpaper.jpg"
                placeholderTextColor={colors.textMuted}
                value={customUrlInput}
                onChangeText={setCustomUrlInput}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.applyBtn, { backgroundColor: colors.primary }]}
                onPress={handleApplyCustomWallpaper}
              >
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Bottom Done Button */}
          <BouncyButton style={styles.doneBtnWrapper} onPress={onClose}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              style={styles.doneBtn}
            >
              <Text style={styles.doneBtnText}>DONE ✨</Text>
            </LinearGradient>
          </BouncyButton>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '85%',
    borderTopWidth: 1.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scrollArea: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonText: {
    color: '#9CA3AF',
    fontWeight: '600',
    fontSize: 14,
  },
  activeModeText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  soundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  soundTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  soundSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  soundToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  soundToggleText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  volumeCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 10,
  },
  volumeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  volumeTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  volumePercentText: {
    fontSize: 12,
    fontWeight: '900',
  },
  volumePillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  volumePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumePillText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  presetList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetItem: {
    width: '47%',
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
  },
  presetItemSelected: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  presetImage: {
    width: '100%',
    height: '100%',
  },
  presetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    padding: 10,
    justifyContent: 'space-between',
  },
  presetEmoji: {
    fontSize: 20,
  },
  presetName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  activeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  customUrlBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  applyBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  doneBtnWrapper: {
    marginTop: 8,
  },
  doneBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

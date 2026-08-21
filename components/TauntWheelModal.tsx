import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { TAUNT_EMOJIS, TAUNT_TEXTS } from '../constants/taunts';
import { TauntItem } from '../types';
import { soundManager } from '../lib/soundManager';

interface TauntWheelModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTaunt: (taunt: TauntItem) => void;
  cooldownActive?: boolean;
}

export const TauntWheelModal: React.FC<TauntWheelModalProps> = ({
  visible,
  onClose,
  onSelectTaunt,
  cooldownActive = false,
}) => {
  const [activeTab, setActiveTab] = useState<'EMOJIS' | 'TEXTS'>('EMOJIS');

  const handleTriggerTaunt = (item: TauntItem) => {
    if (cooldownActive) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectTaunt(item);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>😈 TAUNT DECK</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'EMOJIS' && styles.tabBtnActive]}
              onPress={() => setActiveTab('EMOJIS')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'EMOJIS' && styles.tabBtnTextActive]}>
                🎭 MEME EMOJIS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'TEXTS' && styles.tabBtnActive]}
              onPress={() => setActiveTab('TEXTS')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'TEXTS' && styles.tabBtnTextActive]}>
                💬 DESI TAUNTS
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {activeTab === 'EMOJIS' ? (
            <View style={styles.emojiGrid}>
              {TAUNT_EMOJIS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.emojiCard}
                  onPress={() => handleTriggerTaunt(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiIcon}>{item.content}</Text>
                  <Text style={styles.emojiLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <ScrollView style={styles.textScroll} showsVerticalScrollIndicator={false}>
              {TAUNT_TEXTS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.textTauntChip}
                  onPress={() => handleTriggerTaunt(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.textTauntContent}>{item.content}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {cooldownActive && (
            <View style={styles.cooldownWarning}>
              <Text style={styles.cooldownWarningText}>⏳ Cooldown active (anti-spam)...</Text>
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

interface TauntBannerOverlayProps {
  taunt: {
    senderName: string;
    senderAvatar: string;
    tauntItem: TauntItem;
  } | null;
}

export const TauntBannerOverlay: React.FC<TauntBannerOverlayProps> = ({ taunt }) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (taunt) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      slideAnim.setValue(-100);
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.7);

      Animated.sequence([
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: 20,
            friction: 6,
            tension: 50,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(2800),
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [taunt]);

  if (!taunt) return null;

  return (
    <Animated.View
      style={[
        styles.incomingBanner,
        {
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.incomingHeader}>
        <Text style={styles.incomingSenderAvatar}>{taunt.senderAvatar || '😈'}</Text>
        <Text style={styles.incomingSenderName}>{taunt.senderName} taunted:</Text>
      </View>
      {taunt.tauntItem.type === 'emoji' ? (
        <Text style={styles.incomingEmojiBig}>{taunt.tauntItem.content}</Text>
      ) : (
        <Text style={styles.incomingTauntText}>{taunt.tauntItem.content}</Text>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#0E1322',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '65%',
    borderWidth: 1,
    borderColor: 'rgba(189, 0, 255, 0.3)',
    shadowColor: '#BD00FF',
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#BD00FF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#161C30',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(189, 0, 255, 0.2)',
    borderColor: '#BD00FF',
  },
  tabBtnText: {
    color: '#8A99AD',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabBtnTextActive: {
    color: '#BD00FF',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  emojiCard: {
    width: '22%',
    backgroundColor: '#161C30',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emojiIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  emojiLabel: {
    color: '#8A99AD',
    fontSize: 10,
    fontWeight: 'bold',
  },
  textScroll: {
    maxHeight: 220,
  },
  textTauntChip: {
    backgroundColor: '#161C30',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  textTauntContent: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  cooldownWarning: {
    marginTop: 10,
    alignItems: 'center',
  },
  cooldownWarningText: {
    color: '#FF8C00',
    fontSize: 11,
    fontWeight: 'bold',
  },
  incomingBanner: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 9999,
    backgroundColor: '#1A0B2E',
    borderRadius: 18,
    padding: 14,
    borderWidth: 2,
    borderColor: '#BD00FF',
    shadowColor: '#BD00FF',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 10,
    alignItems: 'center',
  },
  incomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  incomingSenderAvatar: {
    fontSize: 16,
  },
  incomingSenderName: {
    color: '#BD00FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  incomingEmojiBig: {
    fontSize: 48,
    marginVertical: 4,
  },
  incomingTauntText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

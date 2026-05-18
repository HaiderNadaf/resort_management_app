import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

type Props = {
  uri: string;
  label?: string;
};

export function VoicePlaybackButton({ uri, label }: Props) {
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
    };
  }, []);

  const togglePlay = async () => {
    try {
      if (playing && soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setPlaying(false);
        return;
      }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded || !status.didJustFinish) return;
        setPlaying(false);
        void sound.unloadAsync();
        soundRef.current = null;
      });
      await sound.playAsync();
    } catch {
      setPlaying(false);
    }
  };

  return (
    <TouchableOpacity style={styles.btn} onPress={togglePlay}>
      <Ionicons name={playing ? 'stop-circle' : 'play-circle'} size={22} color="#1D391D" />
      <Text style={styles.text}>{playing ? 'Stop' : label || 'Play voice note'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#E7ECE1',
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  text: { color: '#1D391D', fontWeight: '700', fontSize: 13 },
});

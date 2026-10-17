import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  LayoutChangeEvent,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { RoomGuideOverlay } from '../components/RoomGuideOverlay';
import { colors, spacing } from '../theme';

type Props = {
  roomName: string;
  imageUri: string | null;
  onBack: () => void;
  onCaptured: (uri: string) => void;
  onNext: () => void;
};

export function CaptureScreen({
  roomName,
  imageUri,
  onBack,
  onCaptured,
  onNext,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [liveCam, setLiveCam] = useState(false);
  const [camSize, setCamSize] = useState({ w: 1, h: 1 });
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isKitchen = roomName.toLowerCase().includes('kitchen');

  const openLiveGuideCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permission needed', 'Camera access is required.');
        return;
      }
    }
    setLiveCam(true);
  };

  const snapGuided = async () => {
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (photo?.uri) {
        onCaptured(photo.uri);
        setLiveCam(false);
      }
    } catch {
      Alert.alert('Capture failed', 'Could not take photo. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const takePhotoSimple = async () => {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Camera access is required.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        onCaptured(result.assets[0].uri);
        setLiveCam(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const pickGallery = async () => {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Gallery access is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        onCaptured(result.assets[0].uri);
        setLiveCam(false);
      }
    } finally {
      setBusy(false);
    }
  };

  if (liveCam) {
    return (
      <View style={styles.root}>
        <Pressable onPress={() => setLiveCam(false)}>
          <Text style={styles.back}>← Close camera</Text>
        </Pressable>
        <Text style={styles.title}>Map the kitchen</Text>
        <Text style={styles.sub}>
          Like a car reverse camera: move phone until the real counter fits the
          blue CUPBOARD boxes, window near CHIMNEY, floor on the red line — then
          capture.
        </Text>

        <View
          style={styles.cameraBox}
          onLayout={(e: LayoutChangeEvent) => {
            const { width, height } = e.nativeEvent.layout;
            setCamSize({ w: width, h: height });
          }}
        >
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
          />
          <RoomGuideOverlay width={camSize.w} height={camSize.h} />
        </View>

        <Pressable
          style={styles.primaryBtn}
          disabled={busy}
          onPress={snapGuided}
        >
          <Text style={styles.primaryText}>
            {busy ? 'Capturing…' : 'Capture aligned photo'}
          </Text>
        </Pressable>
        <Text style={styles.tip}>
          Tip: stand at the room entrance, keep L-counter fully in frame.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Capture {roomName}</Text>
      <Text style={styles.sub}>
        {isKitchen
          ? 'Use guided camera so Auto design knows where cupboards, chimney and light go.'
          : 'Take a clear photo of the area to redesign.'}
      </Text>

      <View
        style={styles.previewBox}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setCamSize({ w: width, h: height });
        }}
      >
        {imageUri ? (
          <>
            <Image source={{ uri: imageUri }} style={styles.preview} />
            {isKitchen && (
              <RoomGuideOverlay
                width={camSize.w}
                height={camSize.h}
                dim
              />
            )}
          </>
        ) : (
          <Text style={styles.placeholder}>No photo yet</Text>
        )}
      </View>

      {imageUri && isKitchen && (
        <Text style={styles.check}>
          Check: do blue boxes sit on empty counter bays? If not, retake with
          guided camera.
        </Text>
      )}

      <View style={styles.actions}>
        {isKitchen && (
          <Pressable
            style={styles.primaryBtn}
            onPress={openLiveGuideCamera}
            disabled={busy}
          >
            <Text style={styles.primaryText}>Open guided camera (map)</Text>
          </Pressable>
        )}
        <Pressable
          style={isKitchen ? styles.secondaryBtn : styles.primaryBtn}
          onPress={takePhotoSimple}
          disabled={busy}
        >
          <Text
            style={isKitchen ? styles.secondaryText : styles.primaryText}
          >
            Take photo
          </Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={pickGallery}
          disabled={busy}
        >
          <Text style={styles.secondaryText}>Choose from gallery</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, !imageUri && styles.disabled]}
          onPress={onNext}
          disabled={!imageUri}
        >
          <Text style={styles.primaryText}>Continue to Auto design</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  back: { color: colors.textMuted, marginBottom: spacing.md },
  title: { fontSize: 26, color: colors.text, fontWeight: '500' },
  sub: { marginTop: 6, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  previewBox: {
    marginTop: spacing.lg,
    height: 280,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cameraBox: {
    marginTop: spacing.md,
    flex: 1,
    minHeight: 360,
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.md,
  },
  preview: { width: '100%', height: '100%' },
  placeholder: { color: colors.textMuted },
  check: {
    marginTop: 8,
    color: '#7DD3FC',
    fontSize: 12,
    lineHeight: 17,
  },
  tip: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontSize: 15 },
  disabled: { opacity: 0.4 },
});

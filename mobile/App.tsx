import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { HomeScreen } from './src/screens/HomeScreen';
import { RoomScreen } from './src/screens/RoomScreen';
import { CaptureScreen } from './src/screens/CaptureScreen';
import {
  ComposeScreen,
  type PlacedElement,
} from './src/screens/ComposeScreen';
import { PreviewScreen } from './src/screens/PreviewScreen';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { api, type ProjectResult } from './src/api';
import { exportCompositionBlob } from './src/exportCompose';
import type { Step, WizardState } from './src/types';
import { colors } from './src/theme';

const initialWizard: WizardState = {
  room: null,
  imageUri: null,
  style: null,
  color: null,
  selectedItems: [],
  placements: [],
  customerName: '',
};

export default function App() {
  const [step, setStep] = useState<Step>('home');
  const [wizard, setWizard] = useState<WizardState>(initialWizard);
  const [project, setProject] = useState<ProjectResult | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setWizard(initialWizard);
    setProject(null);
    setStep('room');
  };

  const saveCompose = async (placements: PlacedElement[]) => {
    if (!wizard.room || !wizard.imageUri) {
      Alert.alert('Missing info', 'Room and photo are required.');
      return;
    }
    setSaving(true);
    try {
      let resultBlob: Blob | undefined;
      if (Platform.OS === 'web') {
        resultBlob = await exportCompositionBlob(
          wizard.imageUri,
          placements,
          1280,
          960
        );
      }
      const result = await api.composeProject({
        imageUri: wizard.imageUri,
        roomId: wizard.room.id,
        placements,
        customerName: wizard.customerName || undefined,
        resultBlob,
      });
      setWizard((w) => ({
        ...w,
        placements,
        selectedItems: placements.map((p) => ({
          id: p.catalogItemId,
          category: p.category,
          name: p.name,
          description: null,
          thumbnail_url: null,
          base_price: 0,
          style_slug: null,
          style_name: null,
        })),
      }));
      setProject(result);
      setStep('preview');
    } catch (err) {
      Alert.alert(
        'Save failed',
        err instanceof Error ? err.message : 'Unknown error'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="light" />
          {step === 'home' && (
            <HomeScreen
              onStart={() => {
                setWizard(initialWizard);
                setProject(null);
                setStep('room');
              }}
              onProjects={() => setStep('projects')}
            />
          )}
          {step === 'room' && (
            <RoomScreen
              onBack={() => setStep('home')}
              onSelect={(room) => {
                setWizard((w) => ({ ...w, room }));
                setStep('capture');
              }}
            />
          )}
          {step === 'capture' && wizard.room && (
            <CaptureScreen
              roomName={wizard.room.name}
              imageUri={wizard.imageUri}
              onBack={() => setStep('room')}
              onCaptured={(uri) => setWizard((w) => ({ ...w, imageUri: uri }))}
              onNext={() => setStep('compose')}
            />
          )}
          {step === 'compose' && wizard.room && wizard.imageUri && (
            <ComposeScreen
              roomId={wizard.room.id}
              roomName={wizard.room.name}
              imageUri={wizard.imageUri}
              onBack={() => setStep('capture')}
              onSave={saveCompose}
              saving={saving}
            />
          )}
          {step === 'preview' && project && (
            <PreviewScreen
              project={project}
              styleChoice={wizard.style}
              colorChoice={wizard.color}
              items={wizard.selectedItems}
              onHome={() => setStep('home')}
              onAgain={reset}
            />
          )}
          {step === 'projects' && (
            <ProjectsScreen onBack={() => setStep('home')} />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});

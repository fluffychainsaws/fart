import { useEffect } from 'react';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const t = useTheme();
  const scheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.ink,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700', fontFamily: 'Inter_700Bold' },
          contentStyle: { backgroundColor: t.bg },
        }}>
        <Stack.Screen name="index" options={{ title: 'F.A.R.T.', headerTitleAlign: 'center' }} />
        <Stack.Screen name="capture" options={{ title: 'New script' }} />
        <Stack.Screen name="assign/[id]" options={{ title: 'Highlight your lines' }} />
        <Stack.Screen name="rehearse/[id]" options={{ title: 'Rehearsal' }} />
        <Stack.Screen name="selftape/[id]" options={{ title: 'Self-tape' }} />
        <Stack.Screen name="account" options={{ title: 'Your plan' }} />
      </Stack>
    </>
  );
}

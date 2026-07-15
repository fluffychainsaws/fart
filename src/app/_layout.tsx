import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { useTheme } from '@/lib/theme';

export default function RootLayout() {
  const t = useTheme();
  const scheme = useColorScheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.ink,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: t.bg },
        }}>
        <Stack.Screen name="index" options={{ title: 'FART 💨' }} />
        <Stack.Screen name="capture" options={{ title: 'New script' }} />
        <Stack.Screen name="assign/[id]" options={{ title: 'Highlight your lines' }} />
        <Stack.Screen name="rehearse/[id]" options={{ title: 'Rehearsal' }} />
        <Stack.Screen name="selftape/[id]" options={{ title: 'Self-tape' }} />
        <Stack.Screen name="account" options={{ title: 'Your plan' }} />
      </Stack>
    </>
  );
}

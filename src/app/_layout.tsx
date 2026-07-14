import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { theme } from '@/lib/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.ink,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: theme.bg },
        }}>
        <Stack.Screen name="index" options={{ title: 'FART 💨' }} />
        <Stack.Screen name="capture" options={{ title: 'New script' }} />
        <Stack.Screen name="assign/[id]" options={{ title: 'Highlight your lines' }} />
        <Stack.Screen name="rehearse/[id]" options={{ title: 'Rehearsal' }} />
      </Stack>
    </>
  );
}

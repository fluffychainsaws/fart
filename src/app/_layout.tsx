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

import { loadSavedProfilePhoto } from '@/lib/profilePhoto';
import { HomeHeaderButton, SideMenu } from '@/lib/SideMenu';
import { loadSavedPalette, useEffectiveScheme, useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
loadSavedPalette();
loadSavedProfilePhoto();

export default function RootLayout() {
  const t = useTheme();
  const scheme = useEffectiveScheme();
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
          // A home button replaces the back arrow everywhere — full nav
          // lives in the SideMenu's hover/tap drawer instead.
          headerLeft: () => <HomeHeaderButton />,
        }}>
        <Stack.Screen
          name="index"
          options={{ title: 'F.A.R.T.', headerTitleAlign: 'center', headerLeft: () => null }}
        />
        <Stack.Screen name="capture" options={{ title: 'New script' }} />
        <Stack.Screen name="assign/[id]" options={{ title: 'Highlight your lines' }} />
        <Stack.Screen name="rehearse/[id]" options={{ title: 'Rehearsal' }} />
        <Stack.Screen name="account" options={{ title: 'Your plan' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="login" options={{ title: 'Account' }} />
        <Stack.Screen name="admin" options={{ title: 'Monthly analysis' }} />
        <Stack.Screen name="mictest" options={{ title: 'Mic test' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
        <Stack.Screen name="terms" options={{ title: 'Terms of Service' }} />
      </Stack>
      <SideMenu />
    </>
  );
}

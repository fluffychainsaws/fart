import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
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

import { useSession } from '@/lib/auth';
import { loadSavedMenuDocked, useMenuDocked } from '@/lib/menuPref';
import { loadSavedProfilePhoto } from '@/lib/profilePhoto';
import { DockedMenu, HomeHeaderButton, SideMenu } from '@/lib/SideMenu';
import { loadSavedPalette, useEffectiveScheme, useTheme } from '@/lib/theme';

// Below this width the docked sidebar would crowd the content, so we fall back
// to the slide-out drawer (phones, small windows) regardless of preference.
const DOCK_MIN_WIDTH = 700;

SplashScreen.preventAutoHideAsync().catch(() => {});
loadSavedPalette();
loadSavedProfilePhoto();
loadSavedMenuDocked();

export default function RootLayout() {
  const t = useTheme();
  const scheme = useEffectiveScheme();
  const { width } = useWindowDimensions();
  const session = useSession();
  const dockPref = useMenuDocked();
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

  // Signed-out visitors always get the docked menu (so it can't be missed);
  // signed-in users get it per their preference. Only on wide-enough screens.
  const signedOut = session === null;
  const docked = width >= DOCK_MIN_WIDTH && (signedOut || dockPref);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: t.bg }}>
        {docked && <DockedMenu />}
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: t.bg },
              headerTintColor: t.ink,
              headerShadowVisible: false,
              headerTitleStyle: { fontWeight: '700', fontFamily: 'Inter_700Bold' },
              contentStyle: { backgroundColor: t.bg },
              // A home button replaces the back arrow everywhere — full nav
              // lives in the SideMenu's hover/tap drawer instead. When the menu
              // is docked open beside the content, its Home link covers this.
              headerLeft: docked ? undefined : () => <HomeHeaderButton />,
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
        </View>
      </View>
      {/* The slide-out drawer only exists when not docked. */}
      {!docked && <SideMenu />}
    </>
  );
}

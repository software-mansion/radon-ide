import React, { useState, useEffect, useRef, useContext } from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { NiceButton } from './components/NiceButton';
import { UglyButton } from './components/UglyButton';

export default function Home() {
  const ref = useRef(null);

  return (
    <View
      ref={ref}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Link href="/details">Go to details</Link>
      <NiceButton
        onPress={() => {
          alert('yo');
        }}
      />
      <UglyButton />
    </View>
  );
}

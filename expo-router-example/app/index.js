import React, { useState, useEffect, useRef, useContext } from 'react';
import { Button, View } from 'react-native';
import { Link } from 'expo-router';
import { NiceButton } from './components/NiceButton';
import { UglyButton } from './components/UglyButton';

export default function Home() {
  const ref = useRef(null);

  return (
    <View
      ref={ref}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Link href="/details">Go to detailz</Link>
      <Link href="/another">/another</Link>
      <Link href="/another?id=100">/another?id=100</Link>
      <NiceButton
        onPress={() => {
          console.log('Nice button pressed (log)');
          console.warn('Nice button pressed (warn)');
        }}
      />
      <Button
        title="Throw error 1"
        onPress={() => {
          throw new Error('from button');
        }}
      />
      <UglyButton />
    </View>
  );
}

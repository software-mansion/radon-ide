import React, { useState, useEffect, useRef, useContext } from 'react';
import { Button, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { NiceButton } from './components/NiceButton';
import { UglyButton } from './components/UglyButton';

const obj = { a: 7678 };

export default function Home() {
  const ref = useRef(null);

  return (
    <View
      ref={ref}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Link href="/details">Go to details</Link>
      <Link href="/another">/another</Link>
      <Link href="/another?id=100">/another?id=100</Link>
      <NiceButton
        onPress={() => {
          console.log('Nice button pressed', obj);
          console.warn('Yollo');
          console.warn('Yollo3');
          // console.warn('Nice button pressed again');
          // console.log('WWW', window.__REACT_DEVTOOLS_PORT__);
        }}
      />
      <TextInput
        style={{
          height: 40,
          borderColor: 'gray',
          borderWidth: 1,
          width: '70%',
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

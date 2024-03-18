import React from 'react'
import { View } from 'react-native'
import { Text, Icon } from 'react-native-paper'
import { useRandomQuote } from '../../Hooks/useRandomQuote'
import { useRefetchOnFocus } from '../../Hooks/useRefetchOnFocus'

export const HomeScreen = () => {
  const { data: randomQuote, refetch } = useRandomQuote()
  useRefetchOnFocus(refetch)

  return (
    <View
      style={{
        height: '100%',
        backgroundColor: 'black',
        paddingTop: 50,
        paddingLeft: 15,
        paddingRight: 15,
        paddingBottom: 50,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Icon source={'format-quote-open'} size={48} color='white'></Icon>
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
          }}
        >
          <Icon source={'bookmark-outline'} size={24} color='grey'></Icon>
          <Icon source={'share-outline'} size={24} color='grey'></Icon>
        </View>
      </View>
      <View
        style={{
          paddingTop: 100,
          gap: 32,
          height: '100%',
          justifyContent: 'flex-start',
        }}
      >
        <Text
          variant='headlineLarge'
          style={{
            textTransform: 'lowercase',
            color: 'white',
            letterSpacing: 1,
            lineHeight: 40,
          }}
        >
          {randomQuote?.content}
        </Text>

        <Text
          variant='titleLarge'
          style={{
            textTransform: 'lowercase',
            color: 'grey',
          }}
        >
          {randomQuote?.author}
        </Text>
      </View>
    </View>
  )
}

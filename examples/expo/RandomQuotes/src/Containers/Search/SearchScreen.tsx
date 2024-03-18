import React, { useCallback } from 'react'
import { View } from 'react-native'
import { Text, TextInput, Icon, List, Avatar } from 'react-native-paper'
import { MyTabs } from './Components/SearchTabs'

const useSearchScreen = () => {
  const onChangedSearchText = useCallback(() => {}, [])

  return { onChangedSearchText }
}
export const SearchScreen = () => {
  const { onChangedSearchText } = useSearchScreen()
  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: '#EFF4FF',
          paddingTop: 75,
        }}
      >
        <View
          style={{
            paddingLeft: 24,
            paddingRight: 24,
          }}
        >
          {/* Page heading */}
          <View
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              variant='headlineLarge'
              style={{
                fontWeight: 'bold',
                letterSpacing: 1,
                color: 'slategray',
              }}
            >
              Search
            </Text>
            <Icon source={'information-outline'} size={24}></Icon>
          </View>
          {/* Page heading ends */}

          {/* Search input */}
          <View
            style={{
              paddingTop: 24,
              paddingBottom: 24,
            }}
          >
            <TextInput
              theme={{
                roundness: 40,
              }}
              placeholder={'Search'}
              inputMode='text'
              mode='outlined'
              left={<TextInput.Icon icon={'magnify'} color='black' />}
            />
          </View>
          {/* Search input ends */}
        </View>

        {/* Authors and Tags */}
        <MyTabs />
      </View>
    </>
  )
}

import React from 'react'
import { FlatList, StyleSheet, Text, View, Image } from 'react-native'
import { Colors, Fonts, Texts } from '../../Constants'
import HeaderNormal from '../../Components/HeaderNormal'
import { SCREEN_WIDTH } from '../../Utils/common'
import { Images } from '../../Assets'
import { StackActions, useNavigation, useRoute } from '@react-navigation/native'
import { useListQuoteByAuthor } from '../../Hooks/useListQuoteByAuthor'
import { TouchableOpacity } from 'react-native-gesture-handler'

type Props = {
  data?: any
}

const QuoteByAuthorScreen = (props: Props) => {
  const route = useRoute<any>()
  const data = route.params?.data
  const navigation = useNavigation()

  const { data: lsData, isFetching } = useListQuoteByAuthor(data?.slug)

  const renderItem = ({ item, index }: any) => {
    return (
      <TouchableOpacity
        style={styles.viewItem}
        onPress={() => {
          navigation.dispatch(
            StackActions.push(Texts.QuoteDetailsScreen, {
              data: item,
            })
          )
        }}
      >
        {/* <View
          style={[
            styles.viewStt,
            {
              borderColor: randomColor(),
            },
          ]}
        >
          <Text style={styles.txtStt}>{index + 1}</Text>
        </View> */}
        <Text style={styles.txtItem} numberOfLines={3}>
          {item?.content}
        </Text>
      </TouchableOpacity>
    )
  }
  return (
    <View style={styles.container}>
      <HeaderNormal title={'Author ' + data?.name} />
      <View style={styles.body}>
        <FlatList
          ListHeaderComponent={() => {
            return (
              <Image
                source={Images.Bg_Detail}
                style={{
                  marginTop: -80,
                  width: SCREEN_WIDTH - 40,
                  height: 200,
                  resizeMode: 'contain',
                }}
              />
            )
          }}
          contentContainerStyle={{
            paddingTop: 20,
          }}
          data={isFetching ? [] : lsData}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  )
}

export default QuoteByAuthorScreen

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  body: {
    flex: 1,
    backgroundColor: '#FFD2D5',
    paddingHorizontal: 10,
  },
  viewItem: {
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  viewStt: {
    borderWidth: 1,
    backgroundColor: Colors.white,
    width: 44,
    height: 44,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  txtStt: {
    fontSize: 16,
    fontFamily: Fonts.ComingSoonRegular,
    color: Colors.black,
  },
  txtItem: {
    fontSize: 16,
    //     fontFamily: Fonts.ComingSoonRegular,
    color: Colors.black,
    textAlign: 'center',
  },
})

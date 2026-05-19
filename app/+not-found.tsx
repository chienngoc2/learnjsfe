import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      {/* Stack.Screen giúp đổi tiêu đề trên thanh điều hướng khi bị lỗi */}
      <Stack.Screen options={{ title: 'Oops! Không tìm thấy' }} />
      
      <View style={styles.container}>
        <Text style={styles.title}>Trang này không tồn tại sếp ơi!</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Quay lại màn hình chính</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});
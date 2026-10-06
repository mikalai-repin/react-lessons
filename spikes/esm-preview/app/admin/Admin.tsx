import { App, Button, ConfigProvider, DatePicker, Table } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import ruRU from 'antd/locale/ru_RU';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

const rows = Array.from({ length: 25 }, (_, i) => ({ key: i, title: `Игра ${i + 1}`, price: 1000 + i * 10 }));

function Inner() {
  const { message } = App.useApp();
  return (
    <>
      <Button id="antd-btn" type="primary" icon={<ShoppingCartOutlined />} onClick={() => message.success('Добавлено в корзину')}>
        Купить
      </Button>
      <DatePicker id="dp" defaultValue={dayjs('2026-10-06')} format="D MMMM YYYY" />
      <Table size="small" dataSource={rows} columns={[{ title: 'Название', dataIndex: 'title' }, { title: 'Цена', dataIndex: 'price' }]} />
    </>
  );
}

export function Admin() {
  return (
    <ConfigProvider locale={ruRU} theme={{ token: { colorPrimary: '#7a3b12' } }}>
      <App>
        <Inner />
      </App>
    </ConfigProvider>
  );
}

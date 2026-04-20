# Gmail Connector Setup

## English

To connect Gmail, you need a Google Cloud OAuth Client ID:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to **APIs & Services → Library**, search for **Gmail API**, and click **Enable**
4. Navigate to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth client ID**
6. Select **Web application** as the application type
7. Under **Authorized redirect URIs**, add:
8. Click **Create** and copy the **Client ID** and **Client Secret**

> Note: If your app is in "Testing" mode, only test users you add can authorize. For production, you'll need to submit for Google's security review (4-6 weeks for restricted scopes).

## 中文

连接 Gmail 需要 Google Cloud OAuth Client ID：

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建或选择一个项目
3. 进入 **APIs & Services → Library**，搜索 **Gmail API** 并点击 **Enable**
4. 进入 **APIs & Services → Credentials**
5. 点击 **Create Credentials → OAuth client ID**
6. 应用类型选择 **Web application**
7. 在 **Authorized redirect URIs** 中添加回调地址（见下方）
8. 点击 **Create**，复制 **Client ID** 和 **Client Secret**

> 注意：如果应用处于"测试"模式，只有添加的测试用户才能授权。正式发布需要通过 Google 的安全审查（受限 scope 需要 4-6 周）。

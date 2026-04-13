import Navbar from '../components/Navbar';
import PlatformArch from '../components/PlatformArch';
import './Architecture.css';

export default function Architecture() {
  return (
    <div className="arch-page page-enter">
      <Navbar showBack />
      <main className="arch-page__main">
        <h1 className="arch-page__title">平台架构</h1>
        <p className="arch-page__desc">
          AgentCore Demo Platform 的整体架构与演进路线。第一阶段为静态展示 + 链接跳转，后续将集成内嵌 Chat 体验与 AgentCore Runtime 按需启动。
        </p>
        <PlatformArch />
      </main>
    </div>
  );
}

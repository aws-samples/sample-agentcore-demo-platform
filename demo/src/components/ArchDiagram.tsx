import './ArchDiagram.css';

interface Props {
  /** 独立架构图路径，不设则使用共用的 SuperAgent 架构图 */
  architectureImage?: string;
}

export default function ArchDiagram({ architectureImage }: Props) {
  const imgSrc = architectureImage || '/super-agent-architecture.svg';
  const altText = architectureImage ? '架构图' : 'SuperAgent 平台架构图';

  return (
    <div className="arch">
      <img
        src={imgSrc}
        alt={altText}
        className="arch__svg"
      />
    </div>
  );
}

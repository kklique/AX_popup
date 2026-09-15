import { useState } from 'react'
const githubRepositoryUrl = 'https://github.com/kklique/AX_popup'
const gitlabUrl = 'https://gitlab.aigov.go.kr/'
const downloadUrl = `${import.meta.env.BASE_URL}AX_popup-project.tar.gz`
type Platform = 'github' | 'gitlab'

export function DeploymentManager() {
  const [platform, setPlatform] = useState<Platform>('github')
  const [copied, setCopied] = useState(false)
  const [downloadNotice, setDownloadNotice] = useState('프로젝트 압축 파일을 내려받을 수 있습니다.')
  const isGitLab = platform === 'gitlab'
  const repositoryUrl = isGitLab ? gitlabUrl : githubRepositoryUrl
  const copyRepository = async () => {
    try {
      await navigator.clipboard.writeText(repositoryUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }
  const confirmDownload = () => {
    setDownloadNotice('내려받기를 시작했습니다. 브라우저 오른쪽 위의 다운로드 목록에서 진행 상태를 확인해 주세요.')
    window.setTimeout(() => {
      setDownloadNotice('파일이 보이지 않으면 아래의 브라우저별 차단 해제 안내를 확인한 뒤 다시 시도해 주세요.')
    }, 5000)
  }

  return <div className="deployment-page">
    <div className="deployment-hero">
      <div>
        <span className="eyebrow">SOURCE UPLOAD & DEPLOYMENT</span>
        <h1>{isGitLab ? <>GitLab에 올리고<br /><em>웹사이트로 공개하기</em></> : <>GitHub에 올리고<br /><em>웹사이트로 공개하기</em></>}</h1>
        <p>{isGitLab ? 'AI 정부 GitLab에 프로젝트를 업로드할 대상과 기본 순서를 확인하세요.' : '현재 작업 내용을 저장소에 반영한 뒤 GitHub Pages로 공개하는 과정을 한 화면에서 확인하세요.'}</p>
      </div>
      <div className="deployment-status" role="status"><span className="status-dot" aria-hidden="true" />{isGitLab ? 'GitLab 인증 필요' : 'GitHub 인증 필요'}<br /><small>이 작업 공간에는 저장소 업로드 권한이 연결되지 않았습니다.</small></div>
    </div>

    <div className="platform-switch" role="tablist" aria-label="업로드 대상 선택">
      <button role="tab" aria-selected={!isGitLab} className={!isGitLab ? 'selected' : ''} onClick={() => setPlatform('github')}>GitHub 배포</button>
      <button role="tab" aria-selected={isGitLab} className={isGitLab ? 'selected' : ''} onClick={() => setPlatform('gitlab')}>AI 정부 GitLab</button>
    </div>

    <section className="download-panel" aria-labelledby="download-title">
      <div className="download-panel-copy"><span className="download-kicker">프로젝트 내려받기</span><h2 id="download-title">현재 작업물을 압축 파일로 받기</h2><p>아래 버튼을 누르면 {isGitLab ? 'GitLab에 올릴 수 있는' : 'GitHub에 올릴 수 있는'} 프로젝트 묶음의 내려받기가 시작됩니다.</p></div>
      <div className="download-panel-actions"><a className="download-primary" href={downloadUrl} download onClick={confirmDownload}>프로젝트 내려받기 <span aria-hidden="true">↓</span></a><p className="download-status" role="status">{downloadNotice}</p></div>
      <div className="download-help" role="note"><b>내려받기가 막혔나요?</b><p><strong>Chrome·Edge</strong>에서는 오른쪽 위 <em>↓ 다운로드</em>를 누른 뒤, 차단된 파일 옆의 <em>⋯ → 유지</em> 또는 <em>허용</em>을 선택해 주세요.</p><p><strong>Safari</strong>에서는 오른쪽 위 <em>↓ 다운로드</em> 목록에서 파일을 찾고, 브라우저 설정의 <em>웹 사이트 → 다운로드</em>에서 허용으로 바꿔 주세요.</p><button className="secondary-action" onClick={() => window.alert('브라우저 오른쪽 위의 ↓ 다운로드 목록을 먼저 확인해 주세요.\n\nChrome·Edge: 차단된 파일의 ⋯ → 유지 또는 허용\nSafari: 설정 → 웹 사이트 → 다운로드 → 허용')}>차단 해제 방법 다시 보기</button></div>
    </section>

    {isGitLab ? <>
      <section className="repo-card" aria-label="AI 정부 GitLab 업로드 대상">
        <div className="repo-icon" aria-hidden="true">GL</div>
        <div className="repo-address"><span>업로드 대상</span><strong>AI 정부 GitLab</strong><small>{gitlabUrl}</small></div>
        <div className="repo-actions"><button className="secondary-action" onClick={() => void copyRepository()}>{copied ? '주소 복사됨' : '주소 복사'}</button><a className="primary-action" href={gitlabUrl} target="_blank" rel="noreferrer">GitLab 열기 <span aria-hidden="true">↗</span></a></div>
      </section>
      <section className="deploy-steps" aria-label="AI 정부 GitLab 업로드 순서">
        <article className="deploy-step"><span>01</span><div><h2>새 프로젝트 만들기</h2><p>AI 정부 GitLab에 로그인한 뒤 <b>New project</b>에서 프로젝트를 만드세요. 프로젝트 이름은 <b>AX_popup</b>처럼 알아보기 쉽게 정하면 됩니다.</p><a href={gitlabUrl} target="_blank" rel="noreferrer">AI 정부 GitLab 열기 <span aria-hidden="true">↗</span></a></div></article>
        <article className="deploy-step"><span>02</span><div><h2>현재 작업물 업로드</h2><p>새 프로젝트의 파일 업로드 화면에서 내려받은 압축을 푼 폴더 안의 내용물을 올리세요. 비밀번호·접근 키 같은 민감 정보는 포함하지 마세요.</p><code>git push -u origin main</code></div></article>
        <article className="deploy-step"><span>03</span><div><h2>공개 방식 설정</h2><p>업로드 후에는 기관의 GitLab 운영 정책에 맞는 Pages 또는 배포 환경을 선택해 공개하세요. 이 프로젝트의 화면과 서버 기능은 별도로 배포할 수 있습니다.</p></div></article>
      </section>
    </> : <>
      <section className="repo-card" aria-label="대상 GitHub 저장소">
        <div className="repo-icon" aria-hidden="true">⌘</div>
        <div className="repo-address"><span>대상 저장소</span><strong>kklique / AX_popup</strong><small>{githubRepositoryUrl}</small></div>
        <div className="repo-actions"><button className="secondary-action" onClick={() => void copyRepository()}>{copied ? '주소 복사됨' : '주소 복사'}</button><a className="primary-action" href={githubRepositoryUrl} target="_blank" rel="noreferrer">저장소 열기 <span aria-hidden="true">↗</span></a></div>
      </section>
      <section className="deploy-steps" aria-label="GitHub Pages 공개 순서">
        <article className="deploy-step"><span>01</span><div><h2>GitHub에 업로드</h2><p>GitHub에 로그인한 컴퓨터에서 현재 변경 사항을 해당 저장소의 <b>main</b> 브랜치로 올려주세요. 이 작업 공간에서는 계정 권한을 대신 사용할 수 없어, 업로드는 본인 GitHub 인증으로 진행해야 합니다.</p><code>git push -u origin main</code></div></article>
        <article className="deploy-step"><span>02</span><div><h2>Pages 공개 방식 선택</h2><p>저장소의 <b>Settings → Pages</b>에서 Source를 <b>GitHub Actions</b>로 한 번만 선택하세요. 자동 공개 설정은 프로젝트에 이미 준비되어 있습니다.</p><a href={`${githubRepositoryUrl}/settings/pages`} target="_blank" rel="noreferrer">Pages 설정 열기 <span aria-hidden="true">↗</span></a></div></article>
        <article className="deploy-step"><span>03</span><div><h2>공개 상태 확인</h2><p>업로드 후 Actions에서 배포 완료 표시를 확인하세요. 이후 main 브랜치에 변경을 올릴 때마다 최신 화면이 자동으로 공개됩니다.</p><a href={`${githubRepositoryUrl}/actions`} target="_blank" rel="noreferrer">배포 현황 열기 <span aria-hidden="true">↗</span></a></div></article>
      </section>
    </>}
    <section className="deploy-note"><div><b>알아두세요</b><span>{isGitLab ? 'AI 정부 GitLab의 실제 공개·배포 가능 범위는 계정과 기관 운영 정책에 따라 달라집니다.' : 'GitHub Pages는 화면을 공개합니다.'} 매일 보도자료를 수집하고 SQLite 데이터를 저장하는 기능은 별도의 상시 서버에 연결해야 계속 동작합니다.</span></div><button className="text-action" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>맨 위로</button></section>
  </div>
}

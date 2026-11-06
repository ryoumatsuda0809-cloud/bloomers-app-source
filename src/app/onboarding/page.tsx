'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, MapPin, GraduationCap, Music, Briefcase, Lightbulb, HelpCircle, type LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { generateIdeasWithAI, saveOnboardingData } from '@/app/actions/onboarding'
import type { PersonalityData, IdeaCard } from '@/app/actions/onboarding'

export default function OnboardingPage() {
  const router = useRouter()
  const [showGenreSelect, setShowGenreSelect] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState<string>('')

  const GENRES: { id: string; label: string; icon: LucideIcon }[] = [
    { id: 'local', label: '地域・地元の課題', icon: MapPin },
    { id: 'school', label: '学校・大学生活', icon: GraduationCap },
    { id: 'hobby', label: '趣味・好きなこと', icon: Music },
    { id: 'work', label: 'バイト・仕事の効率化', icon: Briefcase },
    { id: 'daily', label: '日常の不便・もったいない', icon: Lightbulb },
    { id: 'other', label: 'まだ分からない', icon: HelpCircle },
  ]

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">

        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl">🌸</span>
          <span className="text-2xl font-bold text-foreground tracking-tight">Bloomers</span>
        </div>

        {showGenreSelect ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="font-heading text-xl font-bold text-foreground">
                どんな分野に興味がありますか？
              </h1>
              <p className="text-muted-foreground text-sm">
                ざっくりで大丈夫です。後から変えられます。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {GENRES.map((genre) => {
                const Icon = genre.icon
                return (
                  <button
                    key={genre.id}
                    onClick={() => setSelectedGenre(genre.id)}
                    className={`h-auto py-3 px-4 rounded-xl border text-left transition ${
                      selectedGenre === genre.id
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'bg-card border-border text-foreground hover:border-primary hover:bg-muted'
                    }`}
                  >
                    <Icon className="size-5 mb-1 opacity-80" />
                    <span className="text-xs font-medium leading-snug">{genre.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  const params = new URLSearchParams({ mode: 'discover' })
                  if (selectedGenre) params.set('genre', selectedGenre)
                  const genreLabel = GENRES.find(g => g.id === selectedGenre)?.label ?? ''
                  if (genreLabel) params.set('genreLabel', genreLabel)
                  router.push(`/chat?${params.toString()}`)
                }}
                disabled={!selectedGenre}
                className="w-full h-11 bg-primary text-primary-foreground text-sm font-semibold rounded-2xl hover:bg-primary/90 transition disabled:opacity-50"
              >
                メンターと話す
              </button>
              <button
                onClick={() => setShowGenreSelect(false)}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition py-2"
              >
                戻る
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="space-y-3">
              <h1 className="font-heading text-2xl font-bold text-foreground leading-snug">
                作りたいアプリ、<br />
                もう決まっていますか？
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                あなたに合ったルートで始めましょう。
              </p>
            </div>

            <button
              onClick={() => router.push('/onboarding/idea-interview')}
              className="w-full h-auto py-5 bg-card hover:bg-muted border border-border hover:border-primary rounded-2xl transition group text-left px-5"
            >
              <p className="text-foreground font-semibold group-hover:text-primary transition-colors">
                決まっています
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                アイデアを4つの質問で実装可能な形に整理します
              </p>
            </button>

            <button
              onClick={() => setShowGenreSelect(true)}
              className="w-full h-auto py-5 bg-card hover:bg-muted border border-border hover:border-primary rounded-2xl transition group text-left px-5"
            >
              <p className="text-foreground font-semibold group-hover:text-primary transition-colors">
                まだ決まっていません
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                メンターと話しながら、一緒に見つけましょう
              </p>
            </button>

            <button
              onClick={() => router.push('/trial')}
              className="w-full h-auto py-4 bg-background hover:bg-muted border border-dashed border-border hover:border-primary rounded-2xl transition group text-left px-5"
            >
              <p className="text-muted-foreground font-medium text-sm group-hover:text-primary transition-colors">
                サンプルで始める
              </p>
              <p className="text-muted-foreground text-xs mt-0.5 opacity-70">
                アイデアがなくても、サンプルから本格的に始められます
              </p>
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// MBTIベースの旧オンボーディングフロー（/onboarding から切り離し済み・将来削除予定）
const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
]

function LegacyOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [timeUsage, setTimeUsage] = useState('')
  const [mbti, setMbti] = useState('')
  const [knowsMbti, setKnowsMbti] = useState<boolean | null>(null)
  const [personalityType, setPersonalityType] = useState<'intuitive' | 'planned' | null>(null)
  const [localPain, setLocalPain] = useState('')
  const [ideas, setIdeas] = useState<IdeaCard[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectError, setSelectError] = useState<string | null>(null)

  const timeChips = [
    'ゲーム・動画', '音楽・ライブ', 'スポーツ・筋トレ',
    'バイト', '勉強・資格', '友達と遊ぶ',
  ]

  const localChips = [
    '地元に○○がない', '大学の手続きが面倒',
    'バイト先の非効率', '趣味仲間と繋がれない',
  ]

  const getMbtiLabel = () => {
    if (knowsMbti === false) {
      return personalityType === 'intuitive' ? 'ENFP（直感型）' : 'ISTJ（計画型）'
    }
    return mbti
  }

  const handleStep3Next = async () => {
    if (!localPain.trim()) return
    setIsLoading(true)
    setStep(4)

    const personality: PersonalityData = {
      timeUsage,
      mbti: getMbtiLabel(),
      localPain,
    }

    const generated = await generateIdeasWithAI(personality)
    setIdeas(generated)
    setIsLoading(false)
  }

  const handleSelectIdea = async (idea: IdeaCard) => {
    setIsLoading(true)
    setSelectError(null)
    const personality: PersonalityData = {
      timeUsage,
      mbti: getMbtiLabel(),
      localPain,
    }
    const result = await saveOnboardingData(personality, idea, ideas)
    if (result.error) {
      setSelectError('保存に失敗しました。もう一度試してください。')
      setIsLoading(false)
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-lg">

        <div className="flex items-center justify-center gap-2 mb-10">
          <span className="text-3xl">🌸</span>
          <span className="text-2xl font-bold text-foreground tracking-tight">Bloomers</span>
        </div>

        {/* Step 1: 時間の使い方 */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2" aria-label="ステップ 1 / 3">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      s === 1 ? 'w-6 bg-primary' : 'w-2 bg-muted'
                    }`}
                  />
                ))}
              </div>
              <h1 className="font-heading text-2xl font-bold text-foreground leading-snug">
                あなたが一番<br />
                時間を使っていることは？
              </h1>
              <p className="text-muted-foreground text-sm">
                趣味でも、バイトでも、なんでも
              </p>
            </div>
            <textarea
              value={timeUsage}
              onChange={(e) => setTimeUsage(e.target.value)}
              placeholder="自由に書いてください..."
              aria-label="一番時間を使っていることを入力"
              className="w-full h-28 bg-card text-foreground placeholder:text-muted-foreground rounded-2xl p-4 resize-none border border-border focus:outline-none focus:border-primary"
            />
            <div className="flex flex-wrap gap-2">
              {timeChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setTimeUsage(chip)}
                  className={`text-xs px-3 py-2.5 rounded-full border transition ${
                    timeUsage === chip
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <Button
              onClick={() => setStep(2)}
              disabled={!timeUsage.trim()}
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-2xl"
            >
              次へ <ArrowRight className="size-4" />
            </Button>
          </div>
        )}

        {/* Step 2: MBTI */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2" aria-label="ステップ 2 / 3">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      s === 2 ? 'w-6 bg-primary' : s < 2 ? 'w-2 bg-primary/70' : 'w-2 bg-muted'
                    }`}
                  />
                ))}
              </div>
              <h1 className="font-heading text-2xl font-bold text-foreground leading-snug">
                MBTIを知っていますか？
              </h1>
            </div>

            {knowsMbti === null && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setKnowsMbti(true)}
                  className="h-16 bg-card hover:bg-muted border border-border rounded-2xl text-foreground font-medium transition"
                >
                  知っている
                </button>
                <button
                  type="button"
                  onClick={() => setKnowsMbti(false)}
                  className="h-16 bg-card hover:bg-muted border border-border rounded-2xl text-foreground font-medium transition"
                >
                  知らない / わからない
                </button>
              </div>
            )}

            {knowsMbti === true && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  {MBTI_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMbti(type)}
                      className={`h-10 rounded-xl text-sm font-medium transition border ${
                        mbti === type
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setKnowsMbti(null); setMbti('') }}
                  className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground transition"
                >
                  <ArrowLeft className="size-4" /> 戻る
                </button>
              </div>
            )}

            {knowsMbti === false && (
              <div className="space-y-4">
                <p className="text-muted-foreground text-center text-sm">
                  直感で選んでください
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPersonalityType('intuitive')}
                    className={`h-20 rounded-2xl border transition p-3 text-left ${
                      personalityType === 'intuitive'
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'bg-card border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <p className="font-semibold">直感型</p>
                    <p className="text-xs mt-1 opacity-70">やりながら考える派</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPersonalityType('planned')}
                    className={`h-20 rounded-2xl border transition p-3 text-left ${
                      personalityType === 'planned'
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'bg-card border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <p className="font-semibold">計画型</p>
                    <p className="text-xs mt-1 opacity-70">まず計画を立てる派</p>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setKnowsMbti(null); setPersonalityType(null) }}
                  className="inline-flex items-center justify-center gap-1 text-muted-foreground text-sm hover:text-foreground transition w-full"
                >
                  <ArrowLeft className="size-4" /> 戻る
                </button>
              </div>
            )}

            {((knowsMbti === true && mbti) || (knowsMbti === false && personalityType)) && (
              <div className="flex gap-3">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="h-12 px-6 border-border text-foreground hover:bg-muted rounded-2xl"
                >
                  <ArrowLeft className="size-4" /> 戻る
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-2xl"
                >
                  次へ <ArrowRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: 地元・日常の不便 */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2" aria-label="ステップ 3 / 3">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      s === 3 ? 'w-6 bg-primary' : 'w-2 bg-primary/70'
                    }`}
                  />
                ))}
              </div>
              <h1 className="font-heading text-2xl font-bold text-foreground leading-snug">
                地元・学校・日常で<br />
                「なんでこれないんだろう」<br />
                と思うことは？
              </h1>
            </div>
            <textarea
              value={localPain}
              onChange={(e) => setLocalPain(e.target.value)}
              placeholder="自由に書いてください..."
              aria-label="地元・学校・日常で不便に思うことを入力"
              className="w-full h-28 bg-card text-foreground placeholder:text-muted-foreground rounded-2xl p-4 resize-none border border-border focus:outline-none focus:border-primary"
            />
            <div className="flex flex-wrap gap-2">
              {localChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setLocalPain(chip)}
                  className={`text-xs px-3 py-2.5 rounded-full border transition ${
                    localPain === chip
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setStep(2)}
                variant="outline"
                className="h-12 px-6 border-border text-foreground hover:bg-muted rounded-2xl"
              >
                <ArrowLeft className="size-4" /> 戻る
              </Button>
              <Button
                onClick={handleStep3Next}
                disabled={!localPain.trim()}
                className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-2xl"
              >
                アイデアを見る
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: アイデア選択 */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-primary text-sm font-medium">あなただけの提案</p>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                {isLoading ? 'あなたを分析中...' : '作るものを選んでください'}
              </h1>
              {isLoading && (
                <p className="text-muted-foreground text-sm">
                  あなたの答えを元にアイデアを考えています
                </p>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {ideas.map((idea) => (
                  <button
                    key={idea.title}
                    onClick={() => handleSelectIdea(idea)}
                    disabled={isLoading}
                    className="w-full text-left bg-card hover:bg-muted border border-border hover:border-primary rounded-2xl p-5 transition group"
                  >
                    <p className="text-foreground font-semibold text-lg group-hover:text-primary transition">
                      {idea.title}
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">
                      {idea.description}
                    </p>
                  </button>
                ))}
                <button
                  onClick={() => setStep(1)}
                  className="w-full text-muted-foreground text-sm hover:text-foreground transition pt-2"
                >
                  最初からやり直す
                </button>
                {selectError && (
                  <p className="text-destructive text-sm text-center">
                    {selectError}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

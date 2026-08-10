// 高校レベルの学習データ(サンプル)。
// 各科目は id / category / question / choices(4択) / answer(正解のindex) / explanation を持つ。
// 後から自由に問題を追加・編集できるよう、素直な配列構造にしてある。
window.QUESTION_DATA = {
  kokugo: {
    label: "国語",
    color: "#e11d48",
    questions: [
      { id: "kk-01", category: "漢字", question: "「憂鬱」の読み方は?", choices: ["ゆううつ", "ゆうう", "ゆうつ", "うつう"], answer: 0, explanation: "「憂鬱(ゆううつ)」。気分が晴れないこと。" },
      { id: "kk-02", category: "漢字", question: "「畢竟」の読み方は?", choices: ["ひっきょう", "ひつきょう", "びきょう", "ひっけい"], answer: 0, explanation: "「畢竟(ひっきょう)」=つまるところ、結局。" },
      { id: "kk-03", category: "漢字", question: "「愛猫家」の対義語的存在として正しい熟語は?", choices: ["愛犬家", "動物家", "猫嫌い", "獣医"], answer: 0, explanation: "猫好きに対し犬好きは「愛犬家」。" },
      { id: "kk-04", category: "四字熟語", question: "「一朝一夕」の意味は?", choices: ["わずかな時間・期間", "毎朝毎晩", "一生に一度", "朝令暮改"], answer: 0, explanation: "「一朝一夕」=わずかな時日。「一朝一夕にはできない」のように使う。" },
      { id: "kk-05", category: "四字熟語", question: "「臥薪嘗胆」の意味に最も近いものは?", choices: ["苦労を重ねて目的を果たそうと努力すること", "自然の中でのんびり暮らすこと", "無駄な努力をすること", "他人の成功を妬むこと"], answer: 0, explanation: "薪の上に寝て苦い肝をなめる故事から、目的達成のため苦労に耐えること。" },
      { id: "kk-06", category: "四字熟語", question: "「杞憂」の意味は?", choices: ["無用の心配", "深い悲しみ", "強い決意", "急な変化"], answer: 0, explanation: "杞の国の人が天が崩れることを心配した故事から、無用な心配のこと。" },
      { id: "kk-07", category: "文法", question: "「食べられる」の「られる」の意味として正しいものは(可能の用法)?", choices: ["食べることができる", "食べさせられる", "食べていらっしゃる", "食べてしまう"], answer: 0, explanation: "「られる」には受身・可能・自発・尊敬の4用法がある。ここは可能。" },
      { id: "kk-08", category: "文法", question: "「先生がおっしゃる」の「おっしゃる」の敬語の種類は?", choices: ["尊敬語", "謙譲語", "丁寧語", "美化語"], answer: 0, explanation: "相手(先生)の動作を高める尊敬語。" },
      { id: "kk-09", category: "文法", question: "「先生に申し上げる」の「申し上げる」の敬語の種類は?", choices: ["謙譲語", "尊敬語", "丁寧語", "美化語"], answer: 0, explanation: "自分の動作をへりくだることで相手を立てる謙譲語。" },
      { id: "kk-10", category: "文法", question: "「彼は速く走る」の「速く」の品詞は?", choices: ["副詞", "形容詞", "連体詞", "形容動詞"], answer: 0, explanation: "用言(動詞)を修飾しているので副詞(形容詞「速い」の連用形とも解釈できるが学校文法では副詞的用法)。" },
      { id: "kk-11", category: "古文単語", question: "古文の「をかし」の意味は?", choices: ["趣がある、美しい", "気の毒だ", "恐ろしい", "退屈だ"], answer: 0, explanation: "「をかし」は知的な面白さ・趣を表す。「あはれ」は情緒的なしみじみとした感動。" },
      { id: "kk-12", category: "古文単語", question: "古文の「あはれなり」の意味は?", choices: ["しみじみとした趣がある", "怒っている", "驚いている", "つまらない"], answer: 0, explanation: "「あはれ」はしみじみとした感動・情趣を表す。" },
      { id: "kk-13", category: "古文単語", question: "古文の「いとほし」の意味は?", choices: ["気の毒だ、かわいそうだ", "とても美しい", "とても嬉しい", "疎ましい"], answer: 0, explanation: "現代語「いとおしい(かわいい)」とは意味がずれる古文単語の代表例。" },
      { id: "kk-14", category: "古文単語", question: "古文の「つとめて」の意味は?", choices: ["早朝", "一生懸命", "夜更け", "たまたま"], answer: 0, explanation: "「つとめて」は早朝を意味する。「あした」も同様に朝を表す。" },
      { id: "kk-15", category: "ことわざ", question: "「他山の石」の意味として正しいものは?", choices: ["他人の失敗や欠点も自分を磨く材料にできる", "他人には無関心でよい", "石橋を叩いて渡る慎重さ", "遠くの物事は関係ない"], answer: 0, explanation: "他人のつまらない言行も自分の知徳を磨く助けになるということ。" },
      { id: "kk-16", category: "ことわざ", question: "「情けは人の為ならず」の正しい意味は?", choices: ["人に親切にすれば巡り巡って自分に返ってくる", "情けをかけるとその人のためにならない", "他人には冷たくすべきだ", "自分のことだけ考えればよい"], answer: 0, explanation: "誤用が多いが、本来は「人のためではなく自分のためになる」という意味。" },
      { id: "kk-17", category: "現代文語彙", question: "「アイロニー」の意味に最も近いのは?", choices: ["皮肉", "共感", "熱意", "無関心"], answer: 0, explanation: "アイロニー(irony)=皮肉、反語。" },
      { id: "kk-18", category: "現代文語彙", question: "「アンビバレント」の意味は?", choices: ["相反する感情が同時にある状態", "曖昧でよくわからない状態", "非常に前向きな状態", "無感情な状態"], answer: 0, explanation: "アンビバレンス(ambivalence)=両価性、相反する感情の同居。" }
    ]
  },
  suugaku: {
    label: "数学",
    color: "#2563eb",
    questions: [
      { id: "su-01", category: "二次関数", question: "y = x² - 4x + 3 の頂点の座標は?", choices: ["(2, -1)", "(2, 1)", "(-2, -1)", "(4, 3)"], answer: 0, explanation: "平方完成すると y=(x-2)²-1 なので頂点は (2, -1)。" },
      { id: "su-02", category: "二次関数", question: "y = -2x² + 8x - 3 の最大値は?", choices: ["5", "8", "-3", "2"], answer: 0, explanation: "平方完成: y=-2(x-2)²+5。上に凸なので最大値5(x=2のとき)。" },
      { id: "su-03", category: "二次方程式", question: "x² - 5x + 6 = 0 の解は?", choices: ["x=2, 3", "x=1, 6", "x=-2, -3", "x=2, -3"], answer: 0, explanation: "因数分解すると (x-2)(x-3)=0。" },
      { id: "su-04", category: "二次方程式", question: "x² + 2x + 3 = 0 の判別式Dの符号は?", choices: ["D < 0(実数解なし)", "D = 0(重解)", "D > 0(異なる2実数解)", "判定不能"], answer: 0, explanation: "D=2²-4×1×3=4-12=-8<0。" },
      { id: "su-05", category: "三角比", question: "sin30°の値は?", choices: ["1/2", "√2/2", "√3/2", "1"], answer: 0, explanation: "30-60-90の直角三角形の辺の比より sin30°=1/2。" },
      { id: "su-06", category: "三角比", question: "cos60°の値は?", choices: ["1/2", "√3/2", "√2/2", "0"], answer: 0, explanation: "cos60°=1/2。sin30°と同じ値になることも覚えておくとよい。" },
      { id: "su-07", category: "三角比", question: "tan45°の値は?", choices: ["1", "0", "√3", "1/√3"], answer: 0, explanation: "45°の直角二等辺三角形では対辺と隣辺が等しいのでtan45°=1。" },
      { id: "su-08", category: "図形と計量", question: "余弦定理 a²=b²+c²-2bc·cosA が使えるのはどんな場合?", choices: ["三角形の3辺や角を求めるとき全般", "直角三角形の時だけ", "円の面積を求めるとき", "平行四辺形の対角線"], answer: 0, explanation: "余弦定理は任意の三角形で成り立つ、辺と角の関係式。" },
      { id: "su-09", category: "確率", question: "サイコロを1回振って偶数の目が出る確率は?", choices: ["1/2", "1/3", "1/6", "2/3"], answer: 0, explanation: "偶数は2,4,6の3通り/全6通り=1/2。" },
      { id: "su-10", category: "確率", question: "赤玉3個・白玉2個から1個取り出すとき、白玉が出る確率は?", choices: ["2/5", "3/5", "1/2", "1/5"], answer: 0, explanation: "白玉2個/全5個=2/5。" },
      { id: "su-11", category: "場合の数", question: "異なる5個から3個を選んで並べる順列の数 ₅P₃ は?", choices: ["60", "10", "125", "15"], answer: 0, explanation: "₅P₃=5×4×3=60。" },
      { id: "su-12", category: "場合の数", question: "異なる5個から3個を選ぶ組合せ ₅C₃ は?", choices: ["10", "60", "20", "15"], answer: 0, explanation: "₅C₃=5!/(3!2!)=10。" },
      { id: "su-13", category: "数列", question: "初項2, 公差3の等差数列の第10項は?", choices: ["29", "27", "32", "23"], answer: 0, explanation: "aₙ=a₁+(n-1)d=2+9×3=29。" },
      { id: "su-14", category: "数列", question: "初項3, 公比2の等比数列の第4項は?", choices: ["24", "12", "48", "18"], answer: 0, explanation: "aₙ=a₁×r^(n-1)=3×2³=24。" },
      { id: "su-15", category: "指数・対数", question: "log₂8 の値は?", choices: ["3", "2", "4", "8"], answer: 0, explanation: "2³=8なのでlog₂8=3。" },
      { id: "su-16", category: "指数・対数", question: "2³ × 2⁴ を計算すると?", choices: ["2⁷", "2¹²", "4⁷", "2⁻¹"], answer: 0, explanation: "指数法則より、掛け算は指数の和。2^(3+4)=2⁷。" },
      { id: "su-17", category: "微分", question: "f(x)=x³ の導関数f'(x)は?", choices: ["3x²", "x²", "3x", "x⁴/4"], answer: 0, explanation: "べき乗の微分公式 (xⁿ)'=nx^(n-1) より 3x²。" },
      { id: "su-18", category: "微分", question: "f(x)=2x²+3x-1 の導関数f'(x)は?", choices: ["4x+3", "4x-1", "2x+3", "4x²+3"], answer: 0, explanation: "各項を微分: (2x²)'=4x, (3x)'=3, (-1)'=0。" }
    ]
  },
  eigo: {
    label: "英語",
    color: "#059669",
    questions: [
      { id: "en-01", category: "単語", question: "「achieve」の意味は?", choices: ["達成する", "避ける", "説明する", "調査する"], answer: 0, explanation: "achieve = 成し遂げる、達成する。名詞形はachievement。" },
      { id: "en-02", category: "単語", question: "「inevitable」の意味は?", choices: ["避けられない", "興味深い", "信じられない", "取り消せる"], answer: 0, explanation: "inevitable = 避けられない、必然の。" },
      { id: "en-03", category: "単語", question: "「generous」の意味は?", choices: ["寛大な", "神経質な", "一般的な", "遺伝的な"], answer: 0, explanation: "generous = 気前がよい、寛大な。名詞generosity。" },
      { id: "en-04", category: "単語", question: "「reluctant」の意味は?", choices: ["気が進まない", "頼りになる", "関連した", "余分な"], answer: 0, explanation: "be reluctant to do = ~するのに気が進まない。" },
      { id: "en-05", category: "熟語", question: "「put off」の意味は?", choices: ["延期する", "実行する", "服を脱ぐ", "電源を入れる"], answer: 0, explanation: "put off = postponeと同義で「延期する」。" },
      { id: "en-06", category: "熟語", question: "「come up with」の意味は?", choices: ["(考えなどを)思いつく", "追いつく", "諦める", "反対する"], answer: 0, explanation: "come up with an idea = アイデアを思いつく。" },
      { id: "en-07", category: "熟語", question: "「in spite of」の意味は?", choices: ["~にもかかわらず", "~のおかげで", "~の代わりに", "~に加えて"], answer: 0, explanation: "in spite of = despiteとほぼ同義。" },
      { id: "en-08", category: "文法", question: "仮定法過去: If I ___ rich, I would travel the world.", choices: ["were", "am", "will be", "had been"], answer: 0, explanation: "現在の事実に反する仮定は if + 主語 + 過去形(be動詞は原則were)。" },
      { id: "en-09", category: "文法", question: "仮定法過去完了: If I had studied harder, I ___ the exam.", choices: ["would have passed", "would pass", "will pass", "passed"], answer: 0, explanation: "過去の事実に反する仮定: if + had + 過去分詞 → 主語 + would have + 過去分詞。" },
      { id: "en-10", category: "文法", question: "分詞構文: ___ tired, she went to bed early.", choices: ["Feeling", "Felt", "Feel", "To feel"], answer: 0, explanation: "「疲れを感じて」という能動の分詞構文なので現在分詞Feeling。" },
      { id: "en-11", category: "文法", question: "関係代名詞: This is the book ___ I bought yesterday.", choices: ["which", "who", "whose", "where"], answer: 0, explanation: "先行詞the bookはモノなのでwhich(またはthat)。目的格なので省略も可。" },
      { id: "en-12", category: "文法", question: "関係代名詞: The man ___ car was stolen called the police.", choices: ["whose", "who", "which", "whom"], answer: 0, explanation: "「その人の車」という所有格の関係を表すのでwhose。" },
      { id: "en-13", category: "文法", question: "現在完了進行形として正しいのは?", choices: ["I have been studying English for two hours.", "I have study English for two hours.", "I am studying English since two hours.", "I had study English for two hours."], answer: 0, explanation: "現在完了進行形は have/has been + 動詞ing。" },
      { id: "en-14", category: "文法", question: "受動態: The window ___ by the wind last night.", choices: ["was broken", "broke", "is broken", "has broke"], answer: 0, explanation: "「窓が風によって割られた」と受け身+過去なのでwas broken。" },
      { id: "en-15", category: "英作文/語法", question: "「~するのに慣れている」を表すのは?", choices: ["be used to doing", "used to do", "be used to do", "get to do"], answer: 0, explanation: "be used to + 動名詞 = ~することに慣れている。used to doは「以前は~していた」。" },
      { id: "en-16", category: "英作文/語法", question: "比較級を使った正しい文はどれ?", choices: ["This problem is more difficult than that one.", "This problem is difficulter than that one.", "This problem is most difficult than that one.", "This problem is much difficult than that one."], answer: 0, explanation: "difficultのような長い形容詞はmoreを使う比較級。" },
      { id: "en-17", category: "熟語", question: "「give up」の意味は?", choices: ["諦める", "手渡す", "起きる", "育てる"], answer: 0, explanation: "give up = 諦める、断念する。give up smokingのように使う。" },
      { id: "en-18", category: "単語", question: "「significant」の意味は?", choices: ["重要な、意義深い", "静かな", "似ている", "科学的な"], answer: 0, explanation: "significant = 重要な、著しい。名詞significance。" }
    ]
  }
};

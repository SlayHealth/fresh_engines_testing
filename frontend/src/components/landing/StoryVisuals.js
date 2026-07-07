const BarChart = ({ data }) => (
  <div className="space-y-4">
    {data.map((item) => (
      <div key={item.label}>
        <div className="flex justify-between text-sm lg:text-base mb-1.5">
          <span style={{ color: 'var(--muted)' }}>{item.label}</span>
          <span className="font-semibold" style={{ color: item.color }}>{item.value}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
        </div>
      </div>
    ))}
  </div>
);

const InfoBox = ({ title, titleColor, items }) => (
  <div className="rounded-xl border p-6 lg:p-7" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>
    <h4 className="text-sm font-bold uppercase tracking-wider mb-5" style={{ color: titleColor }}>{title}</h4>
    <div className="space-y-5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-4">
          <span className="text-base lg:text-lg font-bold font-mono flex-shrink-0 min-w-[76px]" style={{ color: 'var(--ink)' }}>{item.stat}</span>
          <p className="text-sm lg:text-base leading-relaxed" style={{ color: 'var(--muted)' }}>{item.desc}</p>
        </div>
      ))}
    </div>
  </div>
);

const CostComparison = ({ checkCost, checkLabel, fixCost, fixLabel, multiplier }) => (
  <div className="space-y-4">
    <div className="border rounded-xl p-5 flex items-center gap-4" style={{ borderColor: 'var(--teal)' }}>
      <span className="text-xl" style={{ color: 'var(--teal-d)' }}>✓</span>
      <div>
        <p className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--teal-d)' }}>{checkCost}</p>
        <p className="text-sm lg:text-base" style={{ color: 'var(--muted)' }}>{checkLabel}</p>
      </div>
    </div>
    <p className="text-center font-bold text-sm" style={{ color: 'var(--muted)' }}>vs</p>
    <div className="border rounded-xl p-5 flex items-center gap-4" style={{ borderColor: 'var(--danger)' }}>
      <span className="text-xl" style={{ color: 'var(--danger)' }}>✗</span>
      <div>
        <p className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--danger)' }}>{fixCost}</p>
        <p className="text-sm lg:text-base" style={{ color: 'var(--muted)' }}>{fixLabel}</p>
      </div>
    </div>
    <div className="rounded-lg py-3 px-4 text-center" style={{ background: 'var(--soft-danger)' }}>
      <p className="text-sm lg:text-base" style={{ color: 'var(--ink)' }}>That&apos;s <strong style={{ color: 'var(--danger)' }}>{multiplier}</strong> than catching it early</p>
    </div>
  </div>
);

export const InfertilityVisual = () => (
  <div>
    <p className="text-center text-base mb-4" style={{ color: 'var(--muted)' }}>What infertility does to women</p>
    <BarChart data={[
      { label: 'Depression', value: 56, color: '#ef4444' },
      { label: 'Severe Stress', value: 88, color: '#ef4444' },
      { label: 'Anxiety', value: 76, color: '#f59e0b' },
      { label: 'Marital Conflict', value: 62, color: '#3b82f6' }
    ]} />
  </div>
);

export const InfertilityBoxes = () => (
  <div className="grid lg:grid-cols-2 gap-6">
    <InfoBox title="♀ HER REALITY" titleColor="var(--pink-d)" items={[
      { stat: '1 in 5', desc: 'Indian women have PCOS — the #1 cause of female infertility' },
      { stat: '70%', desc: "don't know they have it until they start trying to conceive" },
      { stat: '56%', desc: 'of women facing infertility develop clinical depression' }
    ]} />
    <InfoBox title="♂ HIS REALITY" titleColor="var(--amber-d)" items={[
      { stat: '72%', desc: 'of men visiting fertility clinics have abnormal sperm parameters' },
      { stat: '30%', desc: 'decline in Indian male sperm quality in just 13 years' },
      { stat: '15 min', desc: 'is all a semen analysis takes — yet men test last, years later' }
    ]} />
  </div>
);

export const InfertilityCost = () => (
  <CostComparison checkCost="₹2,999" checkLabel="Complete fertility baseline" fixCost="₹8-15L" fixLabel="IVF cycles + medications + emotional cost" multiplier="50x more" />
);

export const STDVisual = () => (
  <div>
    <p className="text-center text-base mb-4" style={{ color: 'var(--muted)' }}>Asymptomatic carrier rates</p>
    <div className="grid grid-cols-2 gap-4">
      {[
        { name: 'HPV', rate: '90%' },
        { name: 'Chlamydia', rate: '75%' },
        { name: 'Hepatitis B', rate: '70%' },
        { name: 'Herpes', rate: '80%' }
      ].map((item) => (
        <div key={item.name} className="rounded-xl p-5 text-center border" style={{ background: 'var(--soft-amber)', borderColor: 'var(--amber)' }}>
          <p className="text-2xl font-bold" style={{ color: 'var(--amber-d)' }}>{item.rate}</p>
          <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>{item.name}</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>show no symptoms</p>
        </div>
      ))}
    </div>
  </div>
);

export const STDBoxes = () => (
  <div className="grid lg:grid-cols-2 gap-6">
    <InfoBox title="⚠️ THE SILENT CARRIERS" titleColor="var(--amber-d)" items={[
      { stat: '4 Cr', desc: "Indians are Hepatitis B carriers — most don't know" },
      { stat: '90%', desc: 'of HPV infections show no symptoms in men' },
      { stat: '1 in 3', desc: 'sexually active adults will contract an STI before age 25' }
    ]} />
    <InfoBox title="😤 WHAT NOBODY DISCUSSES" titleColor="var(--danger)" items={[
      { stat: '0%', desc: 'of arranged marriages include STD screening in the process' },
      { stat: '₹50K-5L', desc: 'lifetime treatment cost for chronic Hepatitis B' },
      { stat: '70%', desc: 'of cervical cancers are caused by HPV — preventable with a vaccine' }
    ]} />
  </div>
);

export const STDCost = () => (
  <CostComparison checkCost="₹1,500" checkLabel="Complete STI panel" fixCost="₹50K-5L+" fixLabel="Chronic treatment + partner infection risk" multiplier="30x more" />
);

export const ChronicVisual = () => (
  <div>
    <p className="text-center text-base mb-4" style={{ color: 'var(--muted)' }}>Undiagnosed rates in India</p>
    <BarChart data={[
      { label: 'Diabetes (undiagnosed)', value: 50, color: 'var(--info)' },
      { label: 'Hypertension', value: 45, color: 'var(--info)' },
      { label: 'Thyroid disorders', value: 40, color: 'var(--info)' },
      { label: 'Mental health conditions', value: 80, color: 'var(--info)' }
    ]} />
  </div>
);

export const ChronicBoxes = () => (
  <div className="grid lg:grid-cols-2 gap-6">
    <InfoBox title="🏥 THE HIDDEN EPIDEMIC" titleColor="var(--info)" items={[
      { stat: '10.1 Cr', desc: 'Indians have diabetes — half are undiagnosed' },
      { stat: '1 in 8', desc: 'Indian adults have a thyroid disorder, mostly women' },
      { stat: '30%', desc: 'of Indians aged 25-34 have hypertension' }
    ]} />
    <InfoBox title="🧠 MENTAL HEALTH: THE TABOO" titleColor="var(--pink-d)" items={[
      { stat: '15 Cr', desc: 'Indians need mental health support — 80% never seek it' },
      { stat: '1 in 5', desc: 'marriages are severely impacted by undisclosed mental health conditions' },
      { stat: '3x', desc: 'higher divorce risk when mental health conditions are hidden pre-marriage' }
    ]} />
  </div>
);

export const ChronicCost = () => (
  <CostComparison checkCost="₹2,999" checkLabel="Full metabolic + mental health screening" fixCost="₹2-10L/yr" fixLabel="Ongoing treatment + lifestyle disruption" multiplier="30x more" />
);

export const GeneticVisual = () => (
  <div>
    <p className="text-center text-base mb-4" style={{ color: 'var(--muted)' }}>If both parents are carriers...</p>
    <div className="flex justify-center">
      <table className="border-collapse">
        <thead>
          <tr>
            <td className="p-2.5" />
            <td className="p-2.5 text-center font-bold text-base">A</td>
            <td className="p-2.5 text-center font-bold text-base" style={{ color: 'var(--danger)' }}>a</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-2.5 font-bold text-base">A</td>
            <td className="p-2.5"><div className="w-16 h-16 rounded-lg flex items-center justify-center font-bold text-base" style={{ background: 'var(--soft-teal)', color: 'var(--teal-d)' }}>AA</div></td>
            <td className="p-2.5"><div className="w-16 h-16 rounded-lg flex items-center justify-center font-bold text-base" style={{ background: 'var(--soft-amber)', color: 'var(--amber-d)' }}>Aa</div></td>
          </tr>
          <tr>
            <td className="p-2.5 font-bold text-base" style={{ color: 'var(--danger)' }}>a</td>
            <td className="p-2.5"><div className="w-16 h-16 rounded-lg flex items-center justify-center font-bold text-base" style={{ background: 'var(--soft-amber)', color: 'var(--amber-d)' }}>Aa</div></td>
            <td className="p-2.5"><div className="w-16 h-16 rounded-lg flex items-center justify-center font-bold text-base" style={{ background: 'var(--soft-danger)', color: 'var(--danger)' }}>aa</div></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div className="flex justify-center gap-5 text-sm mt-4" style={{ color: 'var(--muted)' }}>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: 'var(--soft-teal)' }} /> Healthy</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: 'var(--soft-amber)' }} /> Carrier</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: 'var(--soft-danger)' }} /> Affected</span>
    </div>
  </div>
);

export const GeneticBoxes = () => (
  <div className="grid lg:grid-cols-2 gap-6">
    <InfoBox title="🚨 THE MATH NOBODY DOES" titleColor="var(--danger)" items={[
      { stat: '1 in 25', desc: 'Indians is a Thalassemia carrier — completely healthy, zero symptoms' },
      { stat: '25%', desc: 'chance of severely affected child if both parents are carriers' },
      { stat: '10,000+', desc: 'children born with Thalassemia Major in India every year' }
    ]} />
    <InfoBox title="❤️ THE LIFETIME COST" titleColor="var(--pink-d)" items={[
      { stat: '₹3-5L', desc: 'per year for blood transfusions and iron chelation therapy' },
      { stat: 'Monthly', desc: 'hospital visits for the child — every month, for life' },
      { stat: '₹20-50L', desc: 'for a bone marrow transplant — if a donor is even found' }
    ]} />
  </div>
);

export const GeneticCost = () => (
  <CostComparison checkCost="₹500" checkLabel="Simple blood test (CBC + HbA2)" fixCost="₹3-5L/yr" fixLabel="Lifetime transfusions + chelation" multiplier="100x more" />
);

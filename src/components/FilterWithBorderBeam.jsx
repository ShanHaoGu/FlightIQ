export default function FilterWithBorderBeam({ children }) {
  return (
    <label className="filter-group filter-with-beam">
      <div className="border-beam" aria-hidden />
      {children}
    </label>
  )
}

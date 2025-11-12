interface SkeletonLoaderProps {
  className?: string;
}

export const SkeletonLoader = ({ className = '' }: SkeletonLoaderProps) => {
  return (
    <div className={`bg-surface-light animate-pulse rounded ${className}`} />
  );
};

export const ReportSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <SkeletonLoader className="h-8 w-48 mb-2" />
        <SkeletonLoader className="h-4 w-32" />
      </div>

      {/* Forecast Skeleton */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <SkeletonLoader className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonLoader className="h-24" />
          <SkeletonLoader className="h-24" />
          <SkeletonLoader className="h-24" />
        </div>
      </div>

      {/* Chart Skeleton */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <SkeletonLoader className="h-48" />
      </div>

      {/* Drivers Skeleton */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <SkeletonLoader className="h-6 w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonLoader key={i} className="h-16" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonLoader;


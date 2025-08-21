import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Cpu, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  Download,
  Settings,
  Layers,
  Palette,
  Monitor,
  FileImage,
  Zap
} from 'lucide-react';
import { toast } from 'react-toastify';

const ProfessionalWorkflow = () => {
  const [images, setImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [batchReport, setBatchReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [workflowType, setWorkflowType] = useState('both');

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const response = await fetch('/api/images');
      const data = await response.json();
      setImages(data);
    } catch (error) {
      console.error('Error loading images:', error);
      toast.error('Failed to load images');
    }
  };

  const analyseImage = async (imageId, workflow) => {
    setLoading(true);
    try {
      const endpoint = workflow === 'indesign' ? 
        `/api/workflow/analyse-indesign/${imageId}` :
        `/api/workflow/analyse-archicad/${imageId}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!response.ok) throw new Error('Analysis failed');

      const analysis = await response.json();
      setCurrentAnalysis(analysis);
      toast.success(`${workflow} analysis completed!`);
    } catch (error) {
      console.error('Error analyzing image:', error);
      toast.error(`Failed to analyse for ${workflow}`);
    } finally {
      setLoading(false);
    }
  };

  const runBatchAnalysis = async () => {
    setLoading(true);
    setBatchReport(null);
    
    try {
      const response = await fetch('/api/workflow/batch-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: workflowType,
          imageIds: selectedImages.length > 0 ? selectedImages : undefined
        })
      });

      if (!response.ok) throw new Error('Batch analysis failed');

      const report = await response.json();
      setBatchReport(report);
      toast.success('Batch analysis completed!');
    } catch (error) {
      console.error('Error in batch analysis:', error);
      toast.error('Failed to run batch analysis');
    } finally {
      setLoading(false);
    }
  };

  const generateProfessionalFilename = async (imageId, options) => {
    try {
      const response = await fetch(`/api/workflow/generate-filename/${imageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });

      if (!response.ok) throw new Error('Filename generation failed');

      const result = await response.json();
      toast.success(`Professional filename: ${result.professionalFilename}`);
      return result;
    } catch (error) {
      console.error('Error generating filename:', error);
      toast.error('Failed to generate professional filename');
    }
  };

  const toggleImageSelection = (imageId) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const selectAllImages = () => {
    setSelectedImages(images.map(img => img.id));
  };

  const clearSelection = () => {
    setSelectedImages([]);
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default: return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Professional Workflow</h1>
        <p className="text-gray-600">
          Optimise your images for InDesign, ArchiCAD, and other professional architectural software.
        </p>
      </div>

      {/* Workflow Selection */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Workflow Analysis</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
            workflowType === 'indesign' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`} onClick={() => setWorkflowType('indesign')}>
            <div className="flex items-center mb-2">
              <FileText className="h-6 w-6 text-blue-600 mr-2" />
              <h3 className="font-semibold">InDesign</h3>
            </div>
            <p className="text-sm text-gray-600">
              Optimise for print layouts, brochures, and publications
            </p>
            <div className="mt-2 text-xs text-gray-500">
              • 300 DPI minimum<br/>
              • CMYK color profiles<br/>
              • JPEG/TIFF formats
            </div>
          </div>

          <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
            workflowType === 'archicad' ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
          }`} onClick={() => setWorkflowType('archicad')}>
            <div className="flex items-center mb-2">
              <Cpu className="h-6 w-6 text-green-600 mr-2" />
              <h3 className="font-semibold">ArchiCAD</h3>
            </div>
            <p className="text-sm text-gray-600">
              Optimise for 3D modeling, textures, and CAD workflows
            </p>
            <div className="mt-2 text-xs text-gray-500">
              • Max 2048px dimensions<br/>
              • Power of 2 sizing<br/>
              • Optimal aspect ratios
            </div>
          </div>

          <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
            workflowType === 'both' ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-gray-400'
          }`} onClick={() => setWorkflowType('both')}>
            <div className="flex items-center mb-2">
              <Layers className="h-6 w-6 text-purple-600 mr-2" />
              <h3 className="font-semibold">Both Workflows</h3>
            </div>
            <p className="text-sm text-gray-600">
              Comprehensive analysis for all professional software
            </p>
            <div className="mt-2 text-xs text-gray-500">
              • Complete optimization<br/>
              • Cross-platform compatibility<br/>
              • Best practices
            </div>
          </div>
        </div>

        {/* Batch Actions */}
        <div className="flex flex-wrap gap-4 items-center">
          <button
            onClick={runBatchAnalysis}
            disabled={loading}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center space-x-2"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            <span>Analyse {selectedImages.length > 0 ? `${selectedImages.length} Selected` : 'All Images'}</span>
          </button>

          <div className="flex space-x-2">
            <button
              onClick={selectAllImages}
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              Select All ({images.length})
            </button>
            <button
              onClick={clearSelection}
              className="text-gray-600 hover:text-gray-800 text-sm underline"
            >
              Clear Selection
            </button>
          </div>

          <div className="text-sm text-gray-600">
            {selectedImages.length > 0 ? `${selectedImages.length} images selected` : 'No selection - will analyse all images'}
          </div>
        </div>
      </div>

      {/* Batch Report */}
      {batchReport && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Workflow Analysis Report</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Images Analyzed</p>
                  <p className="text-2xl font-bold text-blue-900">{batchReport.summary.totalAnalyzed}</p>
                </div>
                <FileImage className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">InDesign Ready</p>
                  <p className="text-2xl font-bold text-green-900">{batchReport.report.readyForInDesign}</p>
                </div>
                <FileText className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600">ArchiCAD Ready</p>
                  <p className="text-2xl font-bold text-purple-900">{batchReport.report.readyForArchiCAD}</p>
                </div>
                <Cpu className="h-8 w-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600">Issues Found</p>
                  <p className="text-2xl font-bold text-yellow-900">{batchReport.report.recommendationsCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <p className="text-gray-800">{batchReport.report.summary}</p>
          </div>

          {/* Detailed Analysis Results */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Detailed Analysis</h3>
            
            {batchReport.analyses.map((analysis, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">{analysis.filename}</h4>
                  <div className="flex space-x-2">
                    {analysis.indesign && (
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        analysis.indesign.readyForProduction 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        InDesign: {analysis.indesign.readyForProduction ? 'Ready' : 'Needs Work'}
                      </span>
                    )}
                    {analysis.archicad && (
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        analysis.archicad.readyForProduction 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        ArchiCAD: {analysis.archicad.readyForProduction ? 'Ready' : 'Needs Work'}
                      </span>
                    )}
                  </div>
                </div>

                {analysis.error ? (
                  <div className="text-red-600 text-sm">{analysis.error}</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.indesign && analysis.indesign.recommendations.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-blue-700 mb-2">InDesign Recommendations:</h5>
                        <div className="space-y-2">
                          {analysis.indesign.recommendations.map((rec, i) => (
                            <div key={i} className="flex items-start space-x-2">
                              {getSeverityIcon(rec.severity)}
                              <div className="text-sm">
                                <p className="font-medium">{rec.issue}</p>
                                <p className="text-gray-600">{rec.suggestion}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.archicad && analysis.archicad.recommendations.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-green-700 mb-2">ArchiCAD Recommendations:</h5>
                        <div className="space-y-2">
                          {analysis.archicad.recommendations.map((rec, i) => (
                            <div key={i} className="flex items-start space-x-2">
                              {getSeverityIcon(rec.severity)}
                              <div className="text-sm">
                                <p className="font-medium">{rec.issue}</p>
                                <p className="text-gray-600">{rec.suggestion}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Selection Grid */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Select Images for Analysis</h2>
        
        {images.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No images found. Upload some images to get started.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.map(image => (
              <div
                key={image.id}
                onClick={() => toggleImageSelection(image.id)}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  selectedImages.includes(image.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {image.url && (
                  <img
                    src={image.url}
                    alt={image.title || image.filename}
                    className="w-full h-24 object-cover"
                  />
                )}
                <div className="p-2">
                  <p className="text-xs text-gray-600 truncate">
                    {image.title || image.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(image.file_size || 0)}
                  </p>
                </div>
                
                {selectedImages.includes(image.id) && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="h-5 w-5 text-blue-500 bg-white rounded-full" />
                  </div>
                )}

                <div className="absolute bottom-2 left-2 flex space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      analyseImage(image.id, 'indesign');
                    }}
                    className="p-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                    title="Analyse for InDesign"
                  >
                    <FileText className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      analyseImage(image.id, 'archicad');
                    }}
                    className="p-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                    title="Analyse for ArchiCAD"
                  >
                    <Cpu className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Individual Analysis Results */}
      {currentAnalysis && (
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">
            Analysis Results: {currentAnalysis.imageInfo?.filename}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium mb-3">Image Analysis</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">File Size:</span> {formatFileSize(currentAnalysis.analysis?.fileSize || 0)}</p>
                {currentAnalysis.analysis?.width && (
                  <p><span className="font-medium">Dimensions:</span> {currentAnalysis.analysis.width} × {currentAnalysis.analysis.height}px</p>
                )}
                {currentAnalysis.analysis?.dpi && (
                  <p><span className="font-medium">Resolution:</span> {currentAnalysis.analysis.dpi} DPI</p>
                )}
                <p><span className="font-medium">Format:</span> {currentAnalysis.analysis?.format || 'Unknown'}</p>
                <p><span className="font-medium">Ready for Production:</span> 
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                    currentAnalysis.readyForProduction 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {currentAnalysis.readyForProduction ? 'Yes' : 'Needs Work'}
                  </span>
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-3">Recommendations</h3>
              {currentAnalysis.recommendations.length === 0 ? (
                <p className="text-green-600 text-sm">✅ No issues found - image is optimized!</p>
              ) : (
                <div className="space-y-3">
                  {currentAnalysis.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      {getSeverityIcon(rec.severity)}
                      <div className="text-sm">
                        <p className="font-medium">{rec.issue}</p>
                        <p className="text-gray-600">{rec.suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalWorkflow; 
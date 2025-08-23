import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Video, Shield, Download, Eye, EyeOff, ExternalLink, FileSpreadsheet, AlertCircle, CheckCircle, Info, Folder } from "lucide-react";

interface VimeoVideo {
  title: string;
  link: string;
  downloadLink: string;
}

interface VimeoFolder {
  uri: string;
  name: string;
  description?: string;
  privacy: {
    view: string;
  };
}

interface VimeoApiResponse {
  data: Array<{
    name: string;
    link: string;
    download?: Array<{
      link: string;
    }>;
  }>;
  paging: {
    next?: string;
    page: number;
    per_page: number;
    total: number;
  };
}

interface VimeoFoldersApiResponse {
  data: VimeoFolder[];
}

export default function Home() {
  const [apiToken, setApiToken] = useState('');
  const [folders, setFolders] = useState<VimeoFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<VimeoFolder | null>(null);
  const [videos, setVideos] = useState<VimeoVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showToken, setShowToken] = useState(false);
  const { toast } = useToast();

  // Fetch folders from Vimeo API
  const fetchFolders = async () => {
    // Input validation
    if (!apiToken.trim()) {
      setError('Please enter your Vimeo API token first');
      return;
    }

    setLoadingFolders(true);
    setError('');
    setSuccess('');
    setFolders([]);
    setSelectedFolder(null);
    setVideos([]);

    try {
      // API request to fetch user's folders
      const response = await fetch('https://api.vimeo.com/me/folders', {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Accept': 'application/vnd.vimeo.*+json;version=3.4'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API token. Please check your credentials.');
        } else if (response.status === 429) {
          throw new Error('API rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`Failed to fetch folders: ${response.status}`);
        }
      }

      const data: VimeoFoldersApiResponse = await response.json();
      setFolders(data.data);
      
      if (data.data.length === 0) {
        setSuccess('API connection successful, but no folders found. This might be because:');
        setError('• Your API token may need additional permissions (scopes) to access folders\n• You may not have any folders created in your Vimeo account\n• Check that your token has "private" scope for accessing personal content');
      } else {
        setSuccess(`Successfully loaded ${data.data.length} folders from your account`);
        toast({
          title: "Success",
          description: `Loaded ${data.data.length} folders successfully`,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoadingFolders(false);
    }
  };

  // Fetch all videos from user account (not from specific album)
  const fetchAllVideos = async () => {
    // Input validation
    if (!apiToken.trim()) {
      setError('Please enter your Vimeo API token');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setVideos([]);
    setSelectedFolder(null);

    try {
      // Fetch all videos with pagination support
      let allVideos: VimeoVideo[] = [];
      let nextUrl: string | null = 'https://api.vimeo.com/me/videos?per_page=100';
      let currentPage = 1;

      while (nextUrl) {
        // Update success message to show progress
        setSuccess(`Fetching all your videos... Page ${currentPage} (${allVideos.length} videos loaded so far)`);
        
        const response = await fetch(nextUrl, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Accept': 'application/vnd.vimeo.*+json;version=3.4'
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Invalid API token. Please check your credentials.');
          } else if (response.status === 429) {
            throw new Error('API rate limit exceeded. Please try again later.');
          } else {
            throw new Error(`API request failed: ${response.status}`);
          }
        }

        const data: VimeoApiResponse = await response.json();
        
        // Extract video information from this page
        const pageVideos: VimeoVideo[] = data.data.map(video => ({
          title: video.name,
          link: video.link,
          downloadLink: video.download ? video.download[0]?.link : 'Not available'
        }));
        
        // Add to total collection
        allVideos = [...allVideos, ...pageVideos];
        
        // Check for next page
        nextUrl = data.paging?.next || null;
        currentPage++;
        
        // Small delay to be nice to the API
        if (nextUrl) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      const videoList = allVideos;

      setVideos(videoList);
      setSuccess(`Successfully fetched ${videoList.length} videos from your account`);
      toast({
        title: "Success",
        description: `Fetched ${videoList.length} videos successfully`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch videos from Vimeo API
  const fetchVideos = async () => {
    // Input validation
    if (!apiToken.trim()) {
      setError('Please enter your Vimeo API token');
      return;
    }
    
    if (!selectedFolder) {
      setError('Please select a folder first');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Extract folder ID from URI (format: /folders/12345678)
      const folderId = selectedFolder.uri.split('/').pop();
      if (!folderId) {
        throw new Error('Invalid folder ID');
      }

      // Fetch all videos with pagination support
      let allVideos: VimeoVideo[] = [];
      let nextUrl: string | null = `https://api.vimeo.com/me/folders/${folderId}/videos?per_page=100`;
      let currentPage = 1;

      while (nextUrl) {
        // Update success message to show progress
        setSuccess(`Fetching videos... Page ${currentPage} (${allVideos.length} videos loaded so far)`);
        
        const response = await fetch(nextUrl, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Accept': 'application/vnd.vimeo.*+json;version=3.4'
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Invalid API token. Please check your credentials.');
          } else if (response.status === 404) {
            throw new Error('Folder not found. Please check the folder ID.');
          } else if (response.status === 429) {
            throw new Error('API rate limit exceeded. Please try again later.');
          } else {
            throw new Error(`API request failed: ${response.status}`);
          }
        }

        const data: VimeoApiResponse = await response.json();
        
        // Extract video information from this page
        const pageVideos: VimeoVideo[] = data.data.map(video => ({
          title: video.name,
          link: video.link,
          downloadLink: video.download ? video.download[0]?.link : 'Not available'
        }));
        
        // Add to total collection
        allVideos = [...allVideos, ...pageVideos];
        
        // Check for next page
        nextUrl = data.paging?.next || null;
        currentPage++;
        
        // Small delay to be nice to the API
        if (nextUrl) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      const videoList = allVideos;

      setVideos(videoList);
      setSuccess(`Successfully fetched ${videoList.length} videos from folder "${selectedFolder.name}"`);
      toast({
        title: "Success",
        description: `Fetched ${videoList.length} videos successfully`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Export videos to Excel file using SheetJS
  const exportToExcel = () => {
    if (videos.length === 0) {
      setError('No videos to export. Please fetch videos first.');
      return;
    }

    try {
      // Create worksheet data
      const worksheetData = [
        ['Video Title', 'Video Link', 'Download Link'],
        ...videos.map(video => [video.title, video.link, video.downloadLink])
      ];

      // Create workbook and worksheet using SheetJS
      const workbook = (window as any).XLSX.utils.book_new();
      const worksheet = (window as any).XLSX.utils.aoa_to_sheet(worksheetData);

      // Add worksheet to workbook
      (window as any).XLSX.utils.book_append_sheet(workbook, worksheet, 'Vimeo Videos');

      // Generate Excel file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      // Create filename based on source
      const folderId = selectedFolder?.uri.split('/').pop();
      const filename = folderId ? `vimeo_videos_folder_${folderId}_${timestamp}.xlsx` : `vimeo_all_videos_${timestamp}.xlsx`;
      
      // Download file
      (window as any).XLSX.writeFile(workbook, filename);
      setSuccess(`Excel file "${filename}" has been downloaded successfully!`);
      toast({
        title: "Export Successful",
        description: `Excel file "${filename}" has been downloaded`,
      });
    } catch (err) {
      setError('Failed to export Excel file. Please try again.');
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export Excel file. Please try again.",
      });
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
            <Video className="h-8 w-8 text-blue-600" />
            Vimeo Video Exporter
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Export video titles and links from your Vimeo albums to Excel files. 
            Enter your API token, select an album, and export to Excel with just a few clicks.
          </p>
        </div>

        {/* Security Notice */}
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <p className="font-medium mb-1">Security & Compliance Notice</p>
            <p className="text-sm">Use your own Vimeo API token and respect Vimeo's terms of service. 
            Your API token is stored temporarily in memory only and is not saved to your device.</p>
          </AlertDescription>
        </Alert>

        {/* Input Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-gray-600" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* API Token Input */}
            <div className="space-y-2">
              <Label htmlFor="api-token">Vimeo API Token</Label>
              <div className="relative">
                <Input
                  id="api-token"
                  type={showToken ? "text" : "password"}
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Enter your Vimeo API token"
                  className="pr-10"
                  data-testid="input-api-token"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  data-testid="button-toggle-token-visibility"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Get your API token from{" "}
                <a href="https://developer.vimeo.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Vimeo Developer
                </a>
                <br />
                <strong>Important:</strong> Your token needs "private" scope to access albums
              </p>
            </div>

            {/* Load Albums Button */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={fetchFolders}
                  disabled={loadingFolders || !apiToken.trim()}
                  variant="outline"
                  className="w-full"
                  data-testid="button-load-folders"
                >
                  {loadingFolders ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <Folder className="h-4 w-4 mr-2" />
                      Load Folders
                    </>
                  )}
                </Button>
                <Button
                  onClick={fetchAllVideos}
                  disabled={loading || !apiToken.trim()}
                  variant="outline"
                  className="w-full"
                  data-testid="button-load-all-videos"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4 mr-2" />
                      Load All Videos
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Load folders OR load all your videos directly (if you don't use folders)
              </p>
            </div>

            {/* Folder Selection */}
            {folders.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="folder-select">Select Folder</Label>
                <Select onValueChange={(value) => {
                  const folder = folders.find(f => f.uri === value);
                  setSelectedFolder(folder || null);
                  setVideos([]); // Clear videos when folder changes
                  setError('');
                  setSuccess('');
                }} data-testid="select-folder">
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a folder to export videos from" />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((folder) => (
                      <SelectItem key={folder.uri} value={folder.uri} data-testid={`folder-option-${folder.uri.split('/').pop()}`}>
                        <div className="flex flex-col">
                          <span className="font-medium">{folder.name}</span>
                          {folder.description && (
                            <span className="text-xs text-gray-500 truncate max-w-60">
                              {folder.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {selectedFolder ? `Selected: ${selectedFolder.name}` : 'Select a folder to continue'}
                </p>
              </div>
            )}

            {/* Fetch Videos Button */}
            {selectedFolder && (
              <Button
                onClick={fetchVideos}
                disabled={loading}
                className="w-full"
                data-testid="button-fetch-videos"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Fetching Videos...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Fetch Videos from "{selectedFolder.name}"
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Status Messages */}
        {error && (
          <Alert variant="destructive" className="mb-6" data-testid="alert-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="whitespace-pre-line">{error}</div>
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50" data-testid="alert-success">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Videos Table */}
        {videos.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-gray-600" />
                  Video Results ({videos.length} videos)
                </CardTitle>
                <Button
                  onClick={exportToExcel}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-export-excel"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export to Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Video Title</TableHead>
                      <TableHead>Video Link</TableHead>
                      <TableHead>Download Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {videos.map((video, index) => (
                      <TableRow key={index} data-testid={`row-video-${index}`}>
                        <TableCell className="font-medium" data-testid={`text-title-${index}`}>
                          {video.title}
                        </TableCell>
                        <TableCell>
                          <a 
                            href={video.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                            data-testid={`link-video-${index}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Video
                          </a>
                        </TableCell>
                        <TableCell>
                          {video.downloadLink !== 'Not available' ? (
                            <a 
                              href={video.downloadLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-green-600 hover:text-green-800 hover:underline flex items-center gap-1"
                              data-testid={`link-download-${index}`}
                            >
                              <Download className="h-3 w-3" />
                              Download
                            </a>
                          ) : (
                            <span className="text-gray-500 italic" data-testid={`text-unavailable-${index}`}>
                              Not available
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Alert className="mt-8 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              How to Use This App
            </h3>
            <ol className="text-blue-800 space-y-2 list-decimal list-inside text-sm">
              <li>
                Create a Vimeo app at{" "}
                <a href="https://developer.vimeo.com/apps" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                  Vimeo Developer Portal
                </a>
                {" "}and generate a Personal Access Token
              </li>
              <li>
                <strong>Important:</strong> Make sure your token has at least these scopes:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li><code className="bg-blue-100 px-1 rounded text-xs">private</code> - to access your personal folders</li>
                  <li><code className="bg-blue-100 px-1 rounded text-xs">public</code> - to access public content</li>
                  <li><code className="bg-blue-100 px-1 rounded text-xs">video_files</code> - to access download links (optional)</li>
                </ul>
              </li>
              <li>Enter your API token and choose one of two options:</li>
              <li className="ml-4">
                <strong>Option A:</strong> Click "Load Folders" → Select a folder → Click "Fetch Videos"
              </li>
              <li className="ml-4">
                <strong>Option B:</strong> Click "Load All Videos" to get all your videos directly (no folders needed)
              </li>
              <li>Review the video list and click "Export to Excel" to download the data</li>
            </ol>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

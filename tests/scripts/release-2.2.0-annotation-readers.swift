import CryptoKit
import Foundation
import PDFKit

let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let doc = PDFDocument(url: url) else { exit(2) }
let matches = (0..<doc.pageCount).flatMap { i in
    (doc.page(at: i)?.annotations ?? []).compactMap { annotation -> String? in
        guard let contents = annotation.contents else { return nil }
        let hash = SHA256.hash(data: Data(contents.utf8)).map { String(format: "%02x", $0) }.joined()
        return "\(i + 1):\(hash)"
    }
}
print(matches.joined(separator: "\n"))
